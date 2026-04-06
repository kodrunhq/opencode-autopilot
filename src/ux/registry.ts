import type { NotificationManager } from "./notifications";
import type { ProgressTracker } from "./progress";
import type { TaskToastManager } from "./task-toast-manager";

let notificationManagerInstance: NotificationManager | null = null;
let progressTrackerInstance: ProgressTracker | null = null;
let taskToastManagerInstance: TaskToastManager | null = null;

export function registerNotificationManager(manager: NotificationManager): void {
	notificationManagerInstance = manager;
}

export function registerProgressTracker(tracker: ProgressTracker): void {
	progressTrackerInstance = tracker;
}

export function registerTaskToastManager(manager: TaskToastManager): void {
	taskToastManagerInstance = manager;
}

export function getNotificationManager(): NotificationManager | null {
	return notificationManagerInstance;
}

export function getProgressTracker(): ProgressTracker | null {
	return progressTrackerInstance;
}

export function getTaskToastManager(): TaskToastManager | null {
	return taskToastManagerInstance;
}

export function resetUxRegistry(): void {
	notificationManagerInstance = null;
	progressTrackerInstance = null;
	taskToastManagerInstance = null;
}
