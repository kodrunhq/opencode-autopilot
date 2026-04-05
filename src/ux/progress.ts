import type { NotificationManager } from "./notifications";
import type { ProgressUpdate } from "./types";

export interface ProgressTrackerOptions {
	readonly notificationManager?: NotificationManager;
}

export class ProgressTracker {
	private readonly notificationManager?: NotificationManager;
	private progress: ProgressUpdate | null = null;
	private phaseName: string | null = null;

	constructor(options: ProgressTrackerOptions = {}) {
		this.notificationManager = options.notificationManager;
	}

	startPhase(phaseName: string, totalSteps: number): void {
		const normalizedTotal = Math.max(0, totalSteps);
		this.phaseName = phaseName;
		this.progress = Object.freeze({
			current: 0,
			total: normalizedTotal,
			label: phaseName,
			detail: "Starting phase",
		});

		void this.notificationManager?.info("Phase started", `${phaseName} has started.`);
	}

	advanceStep(label: string): void {
		if (!this.progress) {
			return;
		}

		const nextCurrent =
			this.progress.total > 0
				? Math.min(this.progress.current + 1, this.progress.total)
				: this.progress.current + 1;

		this.progress = Object.freeze({
			...this.progress,
			current: nextCurrent,
			label,
		});
	}

	complete(): void {
		if (!this.progress) {
			return;
		}

		const completedLabel = this.phaseName ? `${this.phaseName} complete` : "Complete";
		this.progress = Object.freeze({
			...this.progress,
			current: this.progress.total,
			label: completedLabel,
			detail: "Completed",
		});

		void this.notificationManager?.success(
			"Phase complete",
			`${this.phaseName ?? "Phase"} finished.`,
		);
	}

	getProgress(): ProgressUpdate | null {
		return this.progress;
	}

	formatProgress(): string {
		if (!this.progress) {
			return "No active phase";
		}

		return `[${this.progress.current}/${this.progress.total}] ${this.progress.label}...`;
	}
}
