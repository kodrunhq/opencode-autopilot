import { describe, expect, test } from "bun:test";
import type { BackgroundTaskRecord } from "../../src/background/database";
import { executeTask } from "../../src/background/executor";

function createTaskRecord(overrides: Partial<BackgroundTaskRecord> = {}): BackgroundTaskRecord {
	return {
		id: overrides.id ?? "task-1",
		sessionId: overrides.sessionId ?? "session-1",
		description: overrides.description ?? "do work",
		category: overrides.category ?? null,
		status: overrides.status ?? "pending",
		result: overrides.result ?? null,
		error: overrides.error ?? null,
		agent: overrides.agent ?? null,
		model: overrides.model ?? null,
		priority: overrides.priority ?? 50,
		createdAt: overrides.createdAt ?? "2026-04-05T00:00:00.000Z",
		updatedAt: overrides.updatedAt ?? "2026-04-05T00:00:00.000Z",
		startedAt: overrides.startedAt ?? null,
		completedAt: overrides.completedAt ?? null,
	};
}

describe("executeTask", () => {
	test("marks successful execution as completed", async () => {
		const calls: Array<{
			status: string;
			payload?: { result?: string | null; error?: string | null };
		}> = [];

		const result = await executeTask(createTaskRecord(), {
			updateStatus: async (_taskId, status, payload) => {
				calls.push({ status, payload });
			},
			run: async () => "finished successfully",
		});

		expect(result).toEqual({
			taskId: "task-1",
			status: "completed",
			result: "finished successfully",
		});
		expect(calls[0]?.status).toBe("running");
		expect(calls[1]).toEqual({ status: "completed", payload: { result: "finished successfully" } });
	});

	test("marks failed execution as failed", async () => {
		const calls: Array<{
			status: string;
			payload?: { result?: string | null; error?: string | null };
		}> = [];

		const result = await executeTask(createTaskRecord(), {
			updateStatus: async (_taskId, status, payload) => {
				calls.push({ status, payload });
			},
			run: async () => {
				throw new Error("boom");
			},
		});

		expect(result.status).toBe("failed");
		expect(result.error).toBe("boom");
		expect(calls[1]).toEqual({ status: "failed", payload: { error: "boom" } });
	});

	test("marks timed out execution as failed", async () => {
		const calls: Array<{
			status: string;
			payload?: { result?: string | null; error?: string | null };
		}> = [];

		const result = await executeTask(createTaskRecord(), {
			updateStatus: async (_taskId, status, payload) => {
				calls.push({ status, payload });
			},
			run: async (_task, signal) => {
				await new Promise<void>((resolve, reject) => {
					const timeoutId = setTimeout(resolve, 50);
					signal.addEventListener(
						"abort",
						() => {
							clearTimeout(timeoutId);
							reject(signal.reason);
						},
						{ once: true },
					);
				});
				return "late";
			},
			timeoutMs: 5,
		});

		expect(result.status).toBe("failed");
		expect(result.error).toContain("timed out");
		expect(calls[1]?.status).toBe("failed");
	});

	test("returns cancelled when task is cancelled before execution starts", async () => {
		const calls: string[] = [];

		const result = await executeTask(createTaskRecord(), {
			updateStatus: async (_taskId, status) => {
				calls.push(status);
			},
			getTaskById: () => createTaskRecord({ status: "cancelled" }),
		});

		expect(result).toEqual({ taskId: "task-1", status: "cancelled" });
		expect(calls).toEqual([]);
	});

	test("returns cancelled when task is cancelled during execution", async () => {
		let currentTask = createTaskRecord();

		const result = await executeTask(currentTask, {
			updateStatus: async (_taskId, status) => {
				if (status === "running") {
					currentTask = { ...currentTask, status: "running" };
				}
			},
			getTaskById: () => currentTask,
			run: async () => {
				currentTask = { ...currentTask, status: "cancelled" };
				return "ignored";
			},
		});

		expect(result).toEqual({ taskId: "task-1", status: "cancelled" });
	});
});
