import { describe, expect, setSystemTime, test } from "bun:test";
import { TaskStatusDisplay } from "../../src/ux/task-status";

describe("TaskStatusDisplay", () => {
	test("formats active and queued background tasks", () => {
		setSystemTime(new Date("2026-01-01T00:02:00.000Z"));
		const display = new TaskStatusDisplay({ maxDisplayCount: 3 });

		display.updateTasks([
			{
				id: "1",
				description: "Fix type errors",
				status: "running",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
			{
				id: "2",
				description: "Generate tests",
				status: "running",
				createdAt: "2026-01-01T00:01:00.000Z",
			},
			{
				id: "3",
				description: "Update docs",
				status: "pending",
				createdAt: "2026-01-01T00:01:30.000Z",
			},
		]);

		expect(display.getActiveCount()).toBe(2);
		expect(display.getQueueDepth()).toBe(1);
		expect(display.formatStatus()).toBe(
			[
				"Background Tasks: 2 active, 1 queued",
				"- [running] Generate tests (1m ago)",
				"- [running] Fix type errors (2m ago)",
				"- [pending] Update docs (30s ago)",
			].join("\n"),
		);

		setSystemTime();
	});

	test("returns recent completions newest first", () => {
		const display = new TaskStatusDisplay();

		display.updateTasks([
			{
				id: "1",
				description: "Earlier task",
				status: "completed",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
			{
				id: "2",
				description: "Latest task",
				status: "completed",
				createdAt: "2026-01-01T00:02:00.000Z",
			},
			{
				id: "3",
				description: "Running task",
				status: "running",
				createdAt: "2026-01-01T00:03:00.000Z",
			},
		]);

		expect(display.getRecentCompletions(1)).toEqual([
			{
				id: "2",
				description: "Latest task",
				status: "completed",
				createdAt: "2026-01-01T00:02:00.000Z",
			},
		]);
	});
});
