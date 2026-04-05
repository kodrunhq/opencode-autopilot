import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BackgroundManager } from "../../src/background/manager";
import { openKernelDb } from "../../src/kernel/database";

async function waitForCondition(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
	const startedAt = Date.now();
	while (!predicate()) {
		if (Date.now() - startedAt > timeoutMs) {
			throw new Error("Timed out waiting for condition");
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

describe("BackgroundManager", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "background-manager-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("runs full spawn to completion lifecycle", async () => {
		const db = openKernelDb(tempDir);
		try {
			const manager = new BackgroundManager({
				db,
				runTask: async (task) => `done: ${task.description}`,
			});

			const taskId = manager.spawn("session-1", "synthesize report", { priority: 90 });
			expect(manager.getStatus(taskId)?.status).toBe("pending");

			await waitForCondition(() => manager.getStatus(taskId)?.status === "completed");

			const task = manager.getStatus(taskId);
			expect(task?.status).toBe("completed");
			expect(task?.result).toBe("done: synthesize report");

			const listed = manager.list("session-1");
			expect(listed).toHaveLength(1);
			expect(manager.getResult(taskId)?.result).toBe("done: synthesize report");
			await manager.dispose();
		} finally {
			db.close();
		}
	});

	test("cancels queued tasks", async () => {
		const db = openKernelDb(tempDir);
		try {
			const manager = new BackgroundManager({
				db,
				maxConcurrent: 1,
				runTask: async () => {
					await new Promise((resolve) => setTimeout(resolve, 25));
					return "done";
				},
			});

			manager.spawn("session-1", "long-running");
			const queuedTaskId = manager.spawn("session-1", "queued");

			await waitForCondition(() => manager.getStatus(queuedTaskId)?.status === "pending");
			expect(manager.cancel(queuedTaskId)).toBe(true);
			expect(manager.getStatus(queuedTaskId)?.status).toBe("cancelled");
			await manager.dispose();
		} finally {
			db.close();
		}
	});
});
