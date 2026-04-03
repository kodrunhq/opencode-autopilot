import { describe, expect, test } from "bun:test";
import type { TaskNode } from "../../src/orchestrator/wave-assigner";
import { assignWaves } from "../../src/orchestrator/wave-assigner";

describe("assignWaves", () => {
	test("3 independent tasks (no depends_on) all get wave 1", () => {
		const tasks: readonly TaskNode[] = [
			{ id: 1, depends_on: [] },
			{ id: 2, depends_on: [] },
			{ id: 3, depends_on: [] },
		];
		const result = assignWaves(tasks);
		expect(result.assignments.get(1)).toBe(1);
		expect(result.assignments.get(2)).toBe(1);
		expect(result.assignments.get(3)).toBe(1);
		expect(result.cycles).toEqual([]);
	});

	test("linear chain A->B->C assigns waves 1, 2, 3", () => {
		const tasks: readonly TaskNode[] = [
			{ id: 1, depends_on: [] },
			{ id: 2, depends_on: [1] },
			{ id: 3, depends_on: [2] },
		];
		const result = assignWaves(tasks);
		expect(result.assignments.get(1)).toBe(1);
		expect(result.assignments.get(2)).toBe(2);
		expect(result.assignments.get(3)).toBe(3);
		expect(result.cycles).toEqual([]);
	});

	test("diamond dependency assigns correct waves", () => {
		// A(1) and B(2) are independent, C(3) depends on both, D(4) depends on C
		const tasks: readonly TaskNode[] = [
			{ id: 1, depends_on: [] },
			{ id: 2, depends_on: [] },
			{ id: 3, depends_on: [1, 2] },
			{ id: 4, depends_on: [3] },
		];
		const result = assignWaves(tasks);
		expect(result.assignments.get(1)).toBe(1);
		expect(result.assignments.get(2)).toBe(1);
		expect(result.assignments.get(3)).toBe(2);
		expect(result.assignments.get(4)).toBe(3);
		expect(result.cycles).toEqual([]);
	});

	test("circular dependency reports both as cycles, assigns no waves", () => {
		const tasks: readonly TaskNode[] = [
			{ id: 1, depends_on: [2] },
			{ id: 2, depends_on: [1] },
		];
		const result = assignWaves(tasks);
		expect(result.cycles.length).toBe(2);
		expect(result.cycles).toContain(1);
		expect(result.cycles).toContain(2);
		expect(result.assignments.size).toBe(0);
	});

	test("empty task list returns empty assignments", () => {
		const result = assignWaves([]);
		expect(result.assignments.size).toBe(0);
		expect(result.cycles).toEqual([]);
	});

	test("task depending on non-existent ID is treated as wave 1 (graceful)", () => {
		const tasks: readonly TaskNode[] = [{ id: 1, depends_on: [999] }];
		const result = assignWaves(tasks);
		expect(result.assignments.get(1)).toBe(1);
		expect(result.cycles).toEqual([]);
	});

	test("tasks with empty depends_on arrays all get wave 1 (backward compat)", () => {
		const tasks: readonly TaskNode[] = [
			{ id: 10, depends_on: [] },
			{ id: 20, depends_on: [] },
			{ id: 30, depends_on: [] },
		];
		const result = assignWaves(tasks);
		expect(result.assignments.get(10)).toBe(1);
		expect(result.assignments.get(20)).toBe(1);
		expect(result.assignments.get(30)).toBe(1);
		expect(result.cycles).toEqual([]);
	});

	test("mixed: some tasks have depends_on, some don't", () => {
		const tasks: readonly TaskNode[] = [
			{ id: 1, depends_on: [] },
			{ id: 2, depends_on: [] },
			{ id: 3, depends_on: [1] },
			{ id: 4, depends_on: [] },
		];
		const result = assignWaves(tasks);
		expect(result.assignments.get(1)).toBe(1);
		expect(result.assignments.get(2)).toBe(1);
		expect(result.assignments.get(3)).toBe(2);
		expect(result.assignments.get(4)).toBe(1);
		expect(result.cycles).toEqual([]);
	});
});
