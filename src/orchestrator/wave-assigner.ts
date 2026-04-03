/**
 * Automatic wave assignment from task dependencies using Kahn's algorithm.
 * Tasks declare depends_on arrays, this module computes optimal wave numbers.
 * Reuses the cycle detection concept from src/skills/dependency-resolver.ts.
 */

export interface TaskNode {
	readonly id: number;
	readonly depends_on: readonly number[];
}

export interface WaveAssignment {
	readonly assignments: ReadonlyMap<number, number>; // taskId -> wave number
	readonly cycles: readonly number[]; // task IDs participating in cycles
}

/** Hard cap on task count to prevent DoS via crafted dependency chains. */
const MAX_TASKS = 500;

/**
 * Assign wave numbers to tasks based on their depends_on relationships.
 * Uses Kahn's algorithm (BFS-based topological sort):
 *   1. Build in-degree map from depends_on
 *   2. All tasks with in-degree 0 -> Wave 1
 *   3. Remove Wave 1, decrement in-degrees of dependents
 *   4. Repeat for Wave 2, 3, etc.
 *   5. Any remaining tasks are in cycles
 *
 * Tasks with empty depends_on arrays get wave 1 (backward compatible).
 * Dependencies referencing non-existent task IDs are silently ignored.
 */
export function assignWaves(tasks: readonly TaskNode[]): WaveAssignment {
	if (tasks.length === 0) {
		return Object.freeze({
			assignments: Object.freeze(new Map<number, number>()),
			cycles: Object.freeze([] as number[]),
		});
	}

	if (tasks.length > MAX_TASKS) {
		return Object.freeze({
			assignments: Object.freeze(new Map<number, number>()),
			cycles: Object.freeze(tasks.map((t) => t.id)),
		});
	}

	// Build set of valid task IDs
	const validIds = new Set(tasks.map((t) => t.id));

	// Build adjacency list: for each task, which tasks depend on it
	// (reverse of depends_on — "dependents" map)
	const dependents = new Map<number, number[]>();
	for (const id of validIds) {
		dependents.set(id, []);
	}

	// Build in-degree map: count of valid dependencies per task
	const inDegree = new Map<number, number>();
	for (const task of tasks) {
		let degree = 0;
		for (const dep of task.depends_on) {
			if (validIds.has(dep)) {
				degree++;
				const list = dependents.get(dep);
				if (list) {
					list.push(task.id);
				}
			}
		}
		inDegree.set(task.id, degree);
	}

	// BFS: process waves
	const assignments = new Map<number, number>();
	let currentQueue: number[] = [];

	// Initialize with all tasks that have in-degree 0 (wave 1)
	for (const task of tasks) {
		if ((inDegree.get(task.id) ?? 0) === 0) {
			currentQueue.push(task.id);
		}
	}

	let wave = 1;
	while (currentQueue.length > 0) {
		const nextQueue: number[] = [];
		for (const taskId of currentQueue) {
			assignments.set(taskId, wave);
			const deps = dependents.get(taskId) ?? [];
			for (const dependent of deps) {
				const newDegree = (inDegree.get(dependent) ?? 1) - 1;
				inDegree.set(dependent, newDegree);
				if (newDegree === 0) {
					nextQueue.push(dependent);
				}
			}
		}
		currentQueue = nextQueue;
		wave++;
	}

	// Any tasks not assigned a wave are in cycles
	const cycleIds: number[] = [];
	for (const task of tasks) {
		if (!assignments.has(task.id)) {
			cycleIds.push(task.id);
		}
	}

	return Object.freeze({
		assignments: Object.freeze(new Map(assignments)),
		cycles: Object.freeze(cycleIds),
	});
}
