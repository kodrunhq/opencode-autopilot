import type { NotificationManager } from "./notifications";

export type ContextWarningLevel = "none" | "moderate" | "high" | "critical";

export interface ContextWarningMonitorOptions {
	readonly notificationManager?: NotificationManager;
}

const warnedLevelsBySeverity = Object.freeze({
	moderate: Object.freeze({
		title: "Context warning",
		message: "Context at 70%, consider wrapping up",
		notify: (manager: NotificationManager) =>
			manager.info("Context warning", "Context at 70%, consider wrapping up"),
	}),
	high: Object.freeze({
		title: "Context warning",
		message: "Context at 85%, compaction recommended",
		notify: (manager: NotificationManager) =>
			manager.warn("Context warning", "Context at 85%, compaction recommended"),
	}),
	critical: Object.freeze({
		title: "Context warning",
		message: "Context at 95%, force compaction",
		notify: (manager: NotificationManager) =>
			manager.error("Context warning", "Context at 95%, force compaction"),
	}),
});

export class ContextWarningMonitor {
	private readonly notificationManager?: NotificationManager;
	private readonly warnedLevels = new Set<Exclude<ContextWarningLevel, "none">>();
	private warningLevel: ContextWarningLevel = "none";

	constructor(options: ContextWarningMonitorOptions = {}) {
		this.notificationManager = options.notificationManager;
	}

	checkUtilization(inputTokens: number, contextLimit: number): void {
		if (contextLimit <= 0) {
			this.warningLevel = "none";
			return;
		}

		const utilization = inputTokens / contextLimit;
		const nextLevel = getWarningLevelForUtilization(utilization);
		this.warningLevel = nextLevel;

		if (nextLevel === "none" || this.warnedLevels.has(nextLevel)) {
			return;
		}

		this.warnedLevels.add(nextLevel);
		const notifier = warnedLevelsBySeverity[nextLevel];
		if (!notifier || !this.notificationManager) {
			return;
		}

		void notifier.notify(this.notificationManager);
	}

	getWarningLevel(): ContextWarningLevel {
		return this.warningLevel;
	}
}

function getWarningLevelForUtilization(utilization: number): ContextWarningLevel {
	if (utilization >= 0.95) {
		return "critical";
	}

	if (utilization >= 0.85) {
		return "high";
	}

	if (utilization >= 0.7) {
		return "moderate";
	}

	return "none";
}
