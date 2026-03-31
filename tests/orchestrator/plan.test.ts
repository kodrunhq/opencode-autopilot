import { describe, expect, test } from "bun:test";
import { countByStatus, groupByWave, indexTasks } from "../../src/orchestrator/plan";
import type { Task } from "../../src/orchestrator/types";

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 1,
		title: "Test task",
		status: "PENDING",
		wave: 1,
		attempt: 0,
		strike: 0,
		...overrides,
	};
}

describe("indexTasks", () => {
	test("validates and returns frozen array of tasks", () => {
		const tasks: Task[] = [
			makeTask({ id: 1, title: "A", wave: 1 }),
			makeTask({ id: 2, title: "B", wave: 2 }),
		];
		const indexed = indexTasks(tasks);
		expect(indexed).toHaveLength(2);
		expect(indexed[0].title).toBe("A");
		expect(indexed[1].title).toBe("B");
		expect(Object.isFrozen(indexed)).toBe(true);
	});

	test("throws on invalid task data", () => {
		const invalid = [{ id: "not-a-number", title: 123 }] as unknown as Task[];
		expect(() => indexTasks(invalid)).toThrow();
	});

	test("returns frozen empty array for empty input", () => {
		const indexed = indexTasks([]);
		expect(indexed).toHaveLength(0);
		expect(Object.isFrozen(indexed)).toBe(true);
	});
});

describe("groupByWave", () => {
	test("groups tasks into Map by wave number", () => {
		const tasks: readonly Task[] = [
			makeTask({ id: 1, wave: 1 }),
			makeTask({ id: 2, wave: 1 }),
			makeTask({ id: 3, wave: 2 }),
			makeTask({ id: 4, wave: 3 }),
		];
		const grouped = groupByWave(tasks);
		expect(grouped.size).toBe(3);
		expect(grouped.get(1)).toHaveLength(2);
		expect(grouped.get(2)).toHaveLength(1);
		expect(grouped.get(3)).toHaveLength(1);
	});

	test("returns empty map for empty input", () => {
		const grouped = groupByWave([]);
		expect(grouped.size).toBe(0);
	});

	test("preserves task data in grouped results", () => {
		const tasks: readonly Task[] = [makeTask({ id: 5, title: "Wave 2 task", wave: 2 })];
		const grouped = groupByWave(tasks);
		const wave2 = grouped.get(2);
		expect(wave2).toBeDefined();
		expect(wave2?.[0].id).toBe(5);
		expect(wave2?.[0].title).toBe("Wave 2 task");
	});
});

describe("countByStatus", () => {
	test("counts tasks by status correctly", () => {
		const tasks: readonly Task[] = [
			makeTask({ id: 1, status: "PENDING" }),
			makeTask({ id: 2, status: "PENDING" }),
			makeTask({ id: 3, status: "DONE" }),
			makeTask({ id: 4, status: "IN_PROGRESS" }),
		];
		const counts = countByStatus(tasks);
		expect(counts.PENDING).toBe(2);
		expect(counts.DONE).toBe(1);
		expect(counts.IN_PROGRESS).toBe(1);
		expect(counts.FAILED).toBe(0);
		expect(counts.SKIPPED).toBe(0);
		expect(counts.BLOCKED).toBe(0);
	});

	test("returns all zeros for empty array", () => {
		const counts = countByStatus([]);
		expect(counts.PENDING).toBe(0);
		expect(counts.DONE).toBe(0);
		expect(counts.IN_PROGRESS).toBe(0);
		expect(counts.FAILED).toBe(0);
		expect(counts.SKIPPED).toBe(0);
		expect(counts.BLOCKED).toBe(0);
	});
});
