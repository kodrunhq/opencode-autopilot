import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTask, getTaskById, updateStatus } from "../../src/background/repository";
import { openKernelDb } from "../../src/kernel/database";
import { backgroundCore } from "../../src/tools/background";

async function waitForTaskCompletion(
	getStatus: () => string | undefined,
	timeoutMs = 1_000,
): Promise<void> {
	const startedAt = Date.now();
	while (getStatus() !== "completed") {
		if (Date.now() - startedAt > timeoutMs) {
			throw new Error("Timed out waiting for background task completion");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

describe("oc_background core", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "background-tool-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("spawn creates a task", async () => {
		const db = openKernelDb(tempDir);
		try {
			const result = JSON.parse(
				await backgroundCore(
					"spawn",
					{ sessionId: "session-1", description: "draft summary", priority: 60 },
					db,
				),
			);

			expect(result.action).toBe("background_spawn");
			expect(result.task.description).toBe("draft summary");
			expect(result.displayText).toContain("Background task queued");

			await waitForTaskCompletion(() => getTaskById(db, result.task.id)?.status);
		} finally {
			db.close();
		}
	});

	test("status returns current task status", async () => {
		const db = openKernelDb(tempDir);
		try {
			const task = createTask(db, { sessionId: "session-1", description: "inspect status" });

			const result = JSON.parse(await backgroundCore("status", { taskId: task.id }, db));
			expect(result.action).toBe("background_status");
			expect(result.task.id).toBe(task.id);
		} finally {
			db.close();
		}
	});

	test("list returns tasks with optional filters", async () => {
		const db = openKernelDb(tempDir);
		try {
			createTask(db, { sessionId: "session-1", description: "alpha" });
			const running = createTask(db, { sessionId: "session-2", description: "beta" });
			updateStatus(db, running.id, "running");

			const result = JSON.parse(await backgroundCore("list", { status: "running" }, db));
			expect(result.action).toBe("background_list");
			expect(result.tasks).toHaveLength(1);
			expect(result.tasks[0].description).toBe("beta");
		} finally {
			db.close();
		}
	});

	test("cancel cancels a pending task", async () => {
		const db = openKernelDb(tempDir);
		try {
			const task = createTask(db, { sessionId: "session-1", description: "cancel tool task" });

			const result = JSON.parse(await backgroundCore("cancel", { taskId: task.id }, db));
			expect(result.action).toBe("background_cancel");
			expect(result.cancelled).toBe(true);
			expect(result.task.status).toBe("cancelled");
		} finally {
			db.close();
		}
	});

	test("result returns terminal task output", async () => {
		const db = openKernelDb(tempDir);
		try {
			const task = createTask(db, { sessionId: "session-1", description: "collect result" });
			updateStatus(db, task.id, "running");
			updateStatus(db, task.id, "completed", { result: "artifact-ready" });

			const result = JSON.parse(await backgroundCore("result", { taskId: task.id }, db));
			expect(result.action).toBe("background_result");
			expect(result.result.result).toBe("artifact-ready");
			expect(result.displayText).toContain("artifact-ready");
		} finally {
			db.close();
		}
	});
});
