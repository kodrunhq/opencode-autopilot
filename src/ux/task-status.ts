export interface TaskStatusItem {
	readonly id: string;
	readonly description: string;
	readonly status: string;
	readonly createdAt: string;
}

export interface TaskStatusDisplayOptions {
	readonly maxDisplayCount?: number;
}

const DEFAULT_MAX_DISPLAY_COUNT = 5;
const ACTIVE_STATUSES = new Set(["running"]);
const QUEUED_STATUSES = new Set(["pending"]);
const COMPLETED_STATUSES = new Set(["completed"]);

export class TaskStatusDisplay {
	private readonly maxDisplayCount: number;
	private tasks: readonly TaskStatusItem[] = [];

	constructor(options: TaskStatusDisplayOptions = {}) {
		this.maxDisplayCount = options.maxDisplayCount ?? DEFAULT_MAX_DISPLAY_COUNT;
	}

	updateTasks(tasks: readonly TaskStatusItem[]): void {
		this.tasks = [...tasks];
	}

	formatStatus(): string {
		const activeCount = this.getActiveCount();
		const queueDepth = this.getQueueDepth();
		const visibleTasks = this.getDisplayTasks();

		const lines = [`Background Tasks: ${activeCount} active, ${queueDepth} queued`];

		for (const task of visibleTasks) {
			const age = formatAge(task.createdAt);
			const ageSuffix = age ? ` (${age})` : "";
			lines.push(`- [${task.status}] ${task.description}${ageSuffix}`);
		}

		return lines.join("\n");
	}

	getActiveCount(): number {
		return this.tasks.filter((task) => ACTIVE_STATUSES.has(task.status)).length;
	}

	getQueueDepth(): number {
		return this.tasks.filter((task) => QUEUED_STATUSES.has(task.status)).length;
	}

	getRecentCompletions(limit = this.maxDisplayCount): readonly TaskStatusItem[] {
		return this.tasks
			.filter((task) => COMPLETED_STATUSES.has(task.status))
			.toSorted((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
			.slice(0, limit);
	}

	private getDisplayTasks(): readonly TaskStatusItem[] {
		return this.tasks
			.toSorted((left, right) => {
				const leftPriority = getStatusPriority(left.status);
				const rightPriority = getStatusPriority(right.status);
				if (leftPriority !== rightPriority) {
					return leftPriority - rightPriority;
				}
				return toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
			})
			.slice(0, this.maxDisplayCount);
	}
}

function getStatusPriority(status: string): number {
	if (ACTIVE_STATUSES.has(status)) {
		return 0;
	}

	if (QUEUED_STATUSES.has(status)) {
		return 1;
	}

	if (COMPLETED_STATUSES.has(status)) {
		return 2;
	}

	return 3;
}

function toTimestamp(value: string): number {
	const timestamp = Date.parse(value);
	return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatAge(createdAt: string): string | null {
	const createdAtMs = toTimestamp(createdAt);
	if (createdAtMs === 0) {
		return null;
	}

	const elapsedMs = Math.max(0, Date.now() - createdAtMs);
	const elapsedMinutes = Math.floor(elapsedMs / 60_000);
	if (elapsedMinutes > 0) {
		return `${elapsedMinutes}m ago`;
	}

	const elapsedSeconds = Math.floor(elapsedMs / 1_000);
	return `${elapsedSeconds}s ago`;
}
