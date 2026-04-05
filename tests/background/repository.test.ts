import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	cancelTask,
	countByStatus,
	createTask,
	enforceMaxConcurrent,
	getActiveTasks,
	getTaskById,
	getTaskResult,
	updateStatus,
} from "../../src/background/repository";
import { openKernelDb } from "../../src/kernel/database";

describe("background repository", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "background-repository-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("creates, updates, fetches, and cancels tasks", () => {
		const db = openKernelDb(tempDir);
		try {
			const task = createTask(db, {
				sessionId: "session-a",
				description: "run background analysis",
			});

			const running = updateStatus(db, task.id, "running");
			expect(running.status).toBe("running");
			expect(running.startedAt).toBeString();

			const completed = updateStatus(db, task.id, "completed", { result: "done" });
			expect(completed.status).toBe("completed");
			expect(completed.result).toBe("done");

			const result = getTaskResult(db, task.id);
			expect(result).toEqual({
				status: "completed",
				result: "done",
				error: null,
				completedAt: completed.completedAt,
			});

			const pending = createTask(db, {
				sessionId: "session-a",
				description: "cancel me",
			});
			const cancelled = cancelTask(db, pending.id);
			expect(cancelled?.status).toBe("cancelled");

			const fetched = getTaskById(db, pending.id);
			expect(fetched?.status).toBe("cancelled");
		} finally {
			db.close();
		}
	});

	test("lists active tasks and counts by status", () => {
		const db = openKernelDb(tempDir);
		try {
			const pending = createTask(db, {
				sessionId: "session-1",
				description: "pending task",
			});
			const running = createTask(db, {
				sessionId: "session-1",
				description: "running task",
			});
			updateStatus(db, running.id, "running");
			const completed = createTask(db, {
				sessionId: "session-2",
				description: "completed task",
			});
			updateStatus(db, completed.id, "running");
			updateStatus(db, completed.id, "completed", { result: "ok" });

			const active = getActiveTasks(db, "session-1");
			expect(active.map((task) => task.id).sort()).toEqual([pending.id, running.id].sort());
			expect(countByStatus(db, "pending")).toBe(1);
			expect(countByStatus(db, "running")).toBe(1);
			expect(countByStatus(db, "completed")).toBe(1);
		} finally {
			db.close();
		}
	});

	test("enforces running task concurrency limits", () => {
		const db = openKernelDb(tempDir);
		try {
			const tasks = Array.from({ length: 2 }, (_, index) =>
				createTask(db, {
					sessionId: "session-limit",
					description: `task-${index}`,
				}),
			);
			const [firstTask, secondTask] = tasks;
			expect(firstTask).toBeDefined();
			expect(secondTask).toBeDefined();

			if (!firstTask || !secondTask) {
				throw new Error("Expected seeded background tasks");
			}

			updateStatus(db, firstTask.id, "running");
			updateStatus(db, secondTask.id, "running");

			expect(() => enforceMaxConcurrent(db, 2)).toThrow("concurrency limit reached");
			expect(() => enforceMaxConcurrent(db, 3)).not.toThrow();
		} finally {
			db.close();
		}
	});
});
