import { detectPlatform, sendSessionNotification } from "../hooks/session-notification-sender";
import { getLogger } from "../logging/domains";
import type { NotificationManager } from "./notifications";
import type { ModelFallbackInfo, TaskToastStatus, TrackedTask } from "./task-toast-types";

const logger = getLogger("ux", "task-toast-manager");

export interface TaskToastDesktopNotificationsConfig {
	readonly desktop: boolean;
	readonly rateLimit: number;
}

export interface TaskToastManagerOptions {
	readonly desktopNotifications?: TaskToastDesktopNotificationsConfig;
	readonly notificationPlatform?: ReturnType<typeof detectPlatform>;
	readonly notificationSender?: typeof sendSessionNotification;
}

export class TaskToastManager {
	private readonly tasks = new Map<string, TrackedTask>();
	private readonly notifications: NotificationManager;
	private readonly desktopNotifications: TaskToastDesktopNotificationsConfig;
	private readonly notificationPlatform: ReturnType<typeof detectPlatform>;
	private readonly notificationSender: typeof sendSessionNotification;
	private lastDesktopNotificationAt = 0;

	constructor(notifications: NotificationManager, options: TaskToastManagerOptions = {}) {
		this.notifications = notifications;
		this.desktopNotifications = Object.freeze({
			desktop: options.desktopNotifications?.desktop ?? false,
			rateLimit: options.desktopNotifications?.rateLimit ?? 5000,
		});
		this.notificationPlatform = options.notificationPlatform ?? detectPlatform();
		this.notificationSender = options.notificationSender ?? sendSessionNotification;
	}

	addTask(task: {
		id: string;
		sessionId?: string;
		description: string;
		agent: string;
		isBackground: boolean;
		status?: TaskToastStatus;
		category?: string;
		skills?: readonly string[];
		modelInfo?: ModelFallbackInfo;
	}): void {
		const tracked: TrackedTask = {
			id: task.id,
			sessionId: task.sessionId,
			description: task.description,
			agent: task.agent,
			status: task.status ?? "running",
			startedAt: new Date(),
			isBackground: task.isBackground,
			category: task.category,
			skills: task.skills,
			modelInfo: task.modelInfo,
		};

		this.tasks.set(task.id, tracked);
		this.showConsolidatedToast(tracked);
	}

	updateStatus(id: string, status: TaskToastStatus): void {
		const task = this.tasks.get(id);
		if (task) task.status = status;
	}

	updateModelBySession(sessionId: string, modelInfo: ModelFallbackInfo): void {
		if (!sessionId) return;

		const task = Array.from(this.tasks.values()).find((t) => t.sessionId === sessionId);
		if (!task) return;
		if (task.modelInfo?.model === modelInfo.model && task.modelInfo?.type === modelInfo.type)
			return;

		(task as { modelInfo?: ModelFallbackInfo }).modelInfo = modelInfo;
		this.showConsolidatedToast(task);
	}

	removeTask(id: string): void {
		this.tasks.delete(id);
	}

	showCompletionToast(task: { id: string; description: string; duration: string }): void {
		this.removeTask(task.id);

		const remaining = this.getRunningTasks();
		const queued = this.getQueuedTasks();

		let message = `"${task.description}" finished in ${task.duration}`;
		if (remaining.length > 0 || queued.length > 0) {
			message += `\n\nStill running: ${remaining.length} | Queued: ${queued.length}`;
		}

		void this.notifications.success("Task Completed", message, 5000);
		void this.sendDesktopCompletionNotification(message);
	}

	private async sendDesktopCompletionNotification(message: string): Promise<void> {
		if (!this.desktopNotifications.desktop) {
			return;
		}

		const now = Date.now();
		if (now - this.lastDesktopNotificationAt < this.desktopNotifications.rateLimit) {
			logger.debug("Skipped rate-limited desktop task notification", {
				rateLimitMs: this.desktopNotifications.rateLimit,
			});
			return;
		}

		this.lastDesktopNotificationAt = now;

		try {
			await this.notificationSender(this.notificationPlatform, "Task Completed", message);
		} catch (error: unknown) {
			logger.debug("Desktop task notification failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	getRunningTasks(): readonly TrackedTask[] {
		return Array.from(this.tasks.values())
			.filter((t) => t.status === "running")
			.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
	}

	getQueuedTasks(): readonly TrackedTask[] {
		return Array.from(this.tasks.values())
			.filter((t) => t.status === "queued")
			.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
	}

	private showConsolidatedToast(newTask: TrackedTask): void {
		const message = this.buildTaskListMessage(newTask);
		const title = newTask.isBackground ? "New Background Task" : "New Task Executed";
		const running = this.getRunningTasks();
		const queued = this.getQueuedTasks();
		const duration = running.length + queued.length > 2 ? 5000 : 3000;

		void this.notifications.info(
			title,
			message || `${newTask.description} (${newTask.agent})`,
			duration,
		);
	}

	private buildTaskListMessage(newTask: TrackedTask): string {
		const running = this.getRunningTasks();
		const queued = this.getQueuedTasks();
		const lines: string[] = [];

		if (this.isFallbackModel(newTask)) {
			const suffix = this.getFallbackSuffix(newTask.modelInfo?.type ?? "");
			lines.push(`[FALLBACK] Model: ${newTask.modelInfo?.model}${suffix}`);
			lines.push("");
		}

		if (running.length > 0) {
			lines.push(`Running (${running.length}):`);
			for (const task of running) {
				const duration = this.formatDuration(task.startedAt);
				const icon = task.isBackground ? "[BG]" : "[RUN]";
				const isNew = task.id === newTask.id ? " ← NEW" : "";
				const taskId = this.formatTaskIdentifier(task);
				const skillsInfo = task.skills?.length ? ` [${task.skills.join(", ")}]` : "";
				lines.push(`${icon} ${task.description} (${taskId})${skillsInfo} - ${duration}${isNew}`);
			}
		}

		if (queued.length > 0) {
			if (lines.length > 0) lines.push("");
			lines.push(`Queued (${queued.length}):`);
			for (const task of queued) {
				const icon = task.isBackground ? "[Q]" : "[W]";
				const taskId = this.formatTaskIdentifier(task);
				const skillsInfo = task.skills?.length ? ` [${task.skills.join(", ")}]` : "";
				const isNew = task.id === newTask.id ? " ← NEW" : "";
				lines.push(`${icon} ${task.description} (${taskId})${skillsInfo} - Queued${isNew}`);
			}
		}

		return lines.join("\n");
	}

	private isFallbackModel(task: TrackedTask): boolean {
		return (
			task.modelInfo?.type === "inherited" ||
			task.modelInfo?.type === "system-default" ||
			task.modelInfo?.type === "runtime-fallback"
		);
	}

	private getFallbackSuffix(type: string): string {
		const suffixMap: Record<string, string> = {
			inherited: " (inherited from parent)",
			"system-default": " (system default fallback)",
			"runtime-fallback": " (runtime fallback)",
		};
		return suffixMap[type] ?? "";
	}

	private formatTaskIdentifier(task: TrackedTask): string {
		const modelName = task.modelInfo?.model?.split("/").pop();
		if (modelName && task.category) return `${modelName}: ${task.category}`;
		if (modelName) return modelName;
		if (task.category) return `${task.agent}/${task.category}`;
		return task.agent;
	}

	private formatDuration(startedAt: Date): string {
		const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ${minutes % 60}m`;
	}
}
