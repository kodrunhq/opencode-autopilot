import type { NotificationManager } from "./notifications";
import type { ProgressTracker } from "./progress";

/**
 * Module-level UX registry — allows the orchestrator to access UX surfaces
 * registered during plugin init without threading them through every call site.
 * Getters return `null` before registration; callers treat UX as best-effort.
 */

let notificationManagerInstance: NotificationManager | null = null;
let progressTrackerInstance: ProgressTracker | null = null;

export function registerNotificationManager(manager: NotificationManager): void {
	notificationManagerInstance = manager;
}

export function registerProgressTracker(tracker: ProgressTracker): void {
	progressTrackerInstance = tracker;
}

export function getNotificationManager(): NotificationManager | null {
	return notificationManagerInstance;
}

export function getProgressTracker(): ProgressTracker | null {
	return progressTrackerInstance;
}

export function resetUxRegistry(): void {
	notificationManagerInstance = null;
	progressTrackerInstance = null;
}
