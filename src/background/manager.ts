import type { Database } from "bun:sqlite";
import { getLogger } from "../logging/domains";
import type { Logger } from "../logging/types";
import type { TaskStatus } from "../types/background";
import type { BackgroundTaskRecord, BackgroundTaskResultRecord } from "./database";
import { listBackgroundTasks } from "./database";
import { type ExecuteTaskDependencies, type ExecuteTaskResult, executeTask } from "./executor";
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
			priority: options.priority,
		});
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

	private async pumpQueue(): Promise<void> {
		if (this.disposed || this.isPumping) {
			return;
		}

		this.isPumping = true;
		try {
			while (!this.slotManager.isFull()) {
				const nextTask = listBackgroundTasks(this.options.db, {
					status: "pending",
					limit: 1,
					prioritizePending: true,
				})[0];
				if (!nextTask || this.runningTasks.has(nextTask.id)) {
					break;
				}

				const slotId = this.slotManager.acquire();
				if (!slotId) {
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
			this.runningTasks.delete(task.id);
			this.slotManager.release(slotId);
			queueMicrotask(() => {
				if (!this.disposed) {
					void this.pumpQueue();
				}
			});
		}
	}
}
