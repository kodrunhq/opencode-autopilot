import type { Database } from "bun:sqlite";
import { getLogger } from "../logging/domains";
import type { Logger } from "../logging/types";
import type { TaskStatus } from "../types/background";
import type { BackgroundTaskRecord, BackgroundTaskResultRecord } from "./database";
import { listBackgroundTasks } from "./database";
import { type ExecuteTaskDependencies, type ExecuteTaskResult, executeTask } from "./executor";
import { PRIORITY, type PriorityLevel, PriorityQueue } from "./priority-queue";
import {
	cancelTask,
	createTask,
	getActiveTasks,
	getTaskById,
	getTaskResult,
	listTasks,
	updateStatus,
} from "./repository";
import { SlotManager } from "./slot-manager";
import { TaskDependencyTracker } from "./task-dependencies";

function isClosedDatabaseError(error: unknown): boolean {
	return (
		error instanceof RangeError &&
		typeof error.message === "string" &&
		error.message.includes("closed database")
	);
}

export interface BackgroundSpawnOptions {
	readonly category?: string;
	readonly agent?: string;
	readonly model?: string;
	readonly priority?: number;
	readonly parentId?: string;
	readonly dependsOn?: readonly string[];
	readonly timeoutMs?: number;
	readonly executionDelayMs?: number;
}

export interface BackgroundManagerOptions {
	readonly db: Database;
	readonly maxConcurrent?: number;
	readonly logger?: Logger;
	readonly executor?: (
		task: BackgroundTaskRecord,
		deps: ExecuteTaskDependencies,
	) => Promise<ExecuteTaskResult>;
	readonly runTask?: ExecuteTaskDependencies["run"];
	readonly wait?: ExecuteTaskDependencies["wait"];
	readonly timeoutMs?: number;
	readonly executionDelayMs?: number;
}

interface RunningTaskEntry {
	readonly slotId: string;
	readonly promise: Promise<void>;
}

export class BackgroundManager {
	private readonly maxConcurrent: number;
	private readonly logger: Logger;
	private readonly slotManager: SlotManager;
	private readonly pendingTasks = new PriorityQueue<string>();
	private readonly enqueuedTaskIds = new Set<string>();
	private readonly completedTaskIds = new Set<string>();
	private readonly dependencyTracker = new TaskDependencyTracker();
	private readonly runningTasks = new Map<string, RunningTaskEntry>();
	private readonly execute: (
		task: BackgroundTaskRecord,
		deps: ExecuteTaskDependencies,
	) => Promise<ExecuteTaskResult>;
	private disposed = false;
	private isPumping = false;

	constructor(private readonly options: BackgroundManagerOptions) {
		this.maxConcurrent = options.maxConcurrent ?? 5;
		this.logger = options.logger ?? getLogger("background", "manager");
		this.slotManager = new SlotManager(this.maxConcurrent);
		this.execute = options.executor ?? executeTask;
	}

	spawn(sessionId: string, description: string, options: BackgroundSpawnOptions = {}): string {
		if (this.disposed) {
			throw new Error("BackgroundManager is disposed");
		}

		const task = createTask(this.options.db, {
			sessionId,
			description,
			category: options.category,
			agent: options.agent,
			model: options.model,
			priority: options.priority ?? PRIORITY.NORMAL,
		});
		this.dependencyTracker.register(task.id, {
			parentId: options.parentId,
			dependsOn: options.dependsOn,
		});
		this.enqueueTask(task.id, task.priority);
		this.logger.info("Background task queued", {
			backgroundTaskId: task.id,
			sessionId,
			description,
		});
		queueMicrotask(() => {
			void this.pumpQueue();
		});
		return task.id;
	}

	async waitForIdle(timeoutMs = 1_000): Promise<void> {
		const startedAt = Date.now();
		while (true) {
			await Promise.resolve();
			const hasPendingTasks =
				listBackgroundTasks(this.options.db, { status: "pending", limit: 1 }).length > 0;
			const isIdle = this.runningTasks.size === 0 && !hasPendingTasks;
			if (isIdle) {
				return;
			}

			if (Date.now() - startedAt > timeoutMs) {
				throw new Error("Timed out waiting for background manager to become idle");
			}

			await new Promise((resolve) => setTimeout(resolve, 5));
		}
	}

	async dispose(): Promise<void> {
		await this.waitForIdle();
		this.disposed = true;
		this.pendingTasks.clear();
		this.enqueuedTaskIds.clear();
		this.dependencyTracker.clear();
	}

	cancel(taskId: string): boolean {
		const task = getTaskById(this.options.db, taskId);
		if (!task) {
			return false;
		}

		if (task.status !== "pending" && task.status !== "running") {
			return false;
		}

		cancelTask(this.options.db, taskId);
		this.logger.info("Background task cancelled", { backgroundTaskId: taskId });
		return true;
	}

	cancelAll(sessionId?: string): number {
		const activeTasks = getActiveTasks(this.options.db, sessionId);
		let cancelledCount = 0;
		for (const task of activeTasks) {
			if (this.cancel(task.id)) {
				cancelledCount += 1;
			}
		}
		return cancelledCount;
	}

	getStatus(taskId: string): BackgroundTaskRecord | null {
		return getTaskById(this.options.db, taskId);
	}

	list(sessionId?: string, statusFilter?: TaskStatus): readonly BackgroundTaskRecord[] {
		return listTasks(this.options.db, { sessionId, status: statusFilter });
	}

	getResult(taskId: string): BackgroundTaskResultRecord | null {
		return getTaskResult(this.options.db, taskId);
	}

	getBlockedTasks(): readonly BackgroundTaskRecord[] {
		const blockedTaskIds = this.dependencyTracker.getBlockedTasks(this.completedTaskIds);
		const blockedTasks = blockedTaskIds
			.map((taskId) => getTaskById(this.options.db, taskId))
			.filter((task): task is BackgroundTaskRecord => task !== null && task.status === "pending");
		return Object.freeze(blockedTasks);
	}

	getTaskChildren(taskId: string): readonly string[] {
		return this.dependencyTracker.getChildren(taskId);
	}

	private async pumpQueue(): Promise<void> {
		if (this.disposed || this.isPumping) {
			return;
		}

		this.isPumping = true;
		try {
			this.syncPendingTasks();
			while (!this.pendingTasks.isEmpty()) {
				const nextTask = this.dequeueNextReadyTask();
				if (!nextTask) {
					break;
				}

				const priority = normalizePriority(nextTask.priority);
				const slotId = this.slotManager.acquireByPriority(priority);
				if (!slotId) {
					this.enqueueTask(nextTask.id, nextTask.priority);
					break;
				}

				const promise = this.runTask(nextTask, slotId);
				this.runningTasks.set(nextTask.id, { slotId, promise });
			}
		} finally {
			this.isPumping = false;
		}
	}

	private async runTask(task: BackgroundTaskRecord, slotId: string): Promise<void> {
		try {
			await this.execute(task, {
				updateStatus: (taskId, status, payload) => {
					try {
						updateStatus(this.options.db, taskId, status, payload);
					} catch (error: unknown) {
						if (!isClosedDatabaseError(error)) {
							throw error;
						}
					}
				},
				getTaskById: (taskId) => {
					try {
						return getTaskById(this.options.db, taskId);
					} catch (error: unknown) {
						if (isClosedDatabaseError(error)) {
							return null;
						}
						throw error;
					}
				},
				logger: this.logger.child({ backgroundTaskId: task.id, slotId }),
				run: this.options.runTask,
				wait: this.options.wait,
				timeoutMs: this.options.timeoutMs,
				executionDelayMs: this.options.executionDelayMs,
			});
		} catch (error: unknown) {
			if (!isClosedDatabaseError(error)) {
				throw error;
			}
		} finally {
			const currentTask = getTaskById(this.options.db, task.id);
			if (currentTask?.status === "completed") {
				this.completedTaskIds.add(task.id);
			}
			this.runningTasks.delete(task.id);
			this.slotManager.release(slotId);
			queueMicrotask(() => {
				if (!this.disposed) {
					void this.pumpQueue();
				}
			});
		}
	}

	private syncPendingTasks(): void {
		const pendingTasks = listBackgroundTasks(this.options.db, {
			status: "pending",
			prioritizePending: true,
		});

		for (const task of pendingTasks) {
			if (this.runningTasks.has(task.id)) {
				continue;
			}

			this.enqueueTask(task.id, task.priority);
		}
	}

	private dequeueNextReadyTask(): BackgroundTaskRecord | null {
		const blockedTaskIds: string[] = [];

		while (!this.pendingTasks.isEmpty()) {
			const taskId = this.pendingTasks.dequeue();
			if (!taskId) {
				break;
			}

			this.enqueuedTaskIds.delete(taskId);

			const task = getTaskById(this.options.db, taskId);
			if (!task || task.status !== "pending" || this.runningTasks.has(taskId)) {
				continue;
			}

			if (!this.dependencyTracker.areDependenciesMet(taskId, this.completedTaskIds)) {
				blockedTaskIds.push(taskId);
				continue;
			}

			for (const blockedTaskId of blockedTaskIds) {
				const blockedTask = getTaskById(this.options.db, blockedTaskId);
				if (blockedTask?.status === "pending") {
					this.enqueueTask(blockedTask.id, blockedTask.priority);
				}
			}

			return task;
		}

		for (const blockedTaskId of blockedTaskIds) {
			const blockedTask = getTaskById(this.options.db, blockedTaskId);
			if (blockedTask?.status === "pending") {
				this.enqueueTask(blockedTask.id, blockedTask.priority);
			}
		}

		return null;
	}

	private enqueueTask(taskId: string, priority: number): void {
		if (this.enqueuedTaskIds.has(taskId) || this.runningTasks.has(taskId)) {
			return;
		}

		this.pendingTasks.enqueue(taskId, normalizePriority(priority));
		this.enqueuedTaskIds.add(taskId);
	}
}

function normalizePriority(priority: number): PriorityLevel {
	if (priority <= PRIORITY.CRITICAL) {
		return PRIORITY.CRITICAL;
	}

	if (priority <= PRIORITY.HIGH) {
		return PRIORITY.HIGH;
	}

	if (priority <= PRIORITY.NORMAL) {
		return PRIORITY.NORMAL;
	}

	if (priority <= PRIORITY.LOW) {
		return PRIORITY.LOW;
	}

	if (priority >= 75) {
		return PRIORITY.CRITICAL;
	}

	if (priority >= 50) {
		return PRIORITY.HIGH;
	}

	if (priority >= 25) {
		return PRIORITY.NORMAL;
	}

	return PRIORITY.LOW;
}
