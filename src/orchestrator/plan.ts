import { taskSchema } from "./schemas";
import type { Task } from "./types";

const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "FAILED", "SKIPPED", "BLOCKED"] as const;

/**
 * Validates each task against taskSchema and returns a frozen array.
 * Throws on invalid task data.
 */
export function indexTasks(tasks: readonly Task[]): readonly Task[] {
	const validated = tasks.map((task) => taskSchema.parse(task));
	return Object.freeze(validated);
}

/**
 * Groups tasks by wave number into a ReadonlyMap.
 */
export function groupByWave(tasks: readonly Task[]): ReadonlyMap<number, readonly Task[]> {
	const map = new Map<number, readonly Task[]>();

	for (const task of tasks) {
		map.set(task.wave, [...(map.get(task.wave) ?? []), task]);
	}

	return map;
}

/**
 * Counts tasks by status. Returns an object with counts for every possible status.
 */
export function countByStatus(tasks: readonly Task[]): Readonly<Record<string, number>> {
	const counts: Record<string, number> = {};

	for (const status of TASK_STATUSES) {
		counts[status] = 0;
	}

	for (const task of tasks) {
		counts[task.status] = (counts[task.status] ?? 0) + 1;
	}

	return Object.freeze(counts);
}
