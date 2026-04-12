import { describe, expect, test } from "bun:test";
import type { BackgroundTaskRecord } from "../../src/background/database";
import { type BackgroundSdkOperations, createSdkRunner } from "../../src/background/sdk-runner";

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

describe("createSdkRunner", () => {
	test("calls sdk.promptAsync with sessionId, model, and parts", async () => {
		const calls: Array<{
			sessionId: string;
			model: string | undefined;
			parts: ReadonlyArray<{ type: "text"; text: string }>;
		}> = [];
		const sdk: BackgroundSdkOperations = {
			promptAsync: async (sessionId, model, parts) => {
				calls.push({ sessionId, model, parts });
			},
		};

		const run = createSdkRunner(sdk);
		await run(
			createTaskRecord({ description: "dispatch this", model: "gpt-5.4" }),
			new AbortController().signal,
		);

		expect(calls).toEqual([
			{
				sessionId: "session-1",
				model: "gpt-5.4",
				parts: [{ type: "text", text: "dispatch this" }],
			},
		]);
	});

	test("returns message with agent and model labels when both are set", async () => {
		const sdk: BackgroundSdkOperations = {
			promptAsync: async () => {},
		};

		const run = createSdkRunner(sdk);
		const result = await run(
			createTaskRecord({ agent: "planner", model: "gpt-5.4", description: "plan work" }),
			new AbortController().signal,
		);

		expect(result).toBe(
			"Background task dispatched via planner (gpt-5.4). Summary: plan work. Prompt delivered to child session.",
		);
	});

	test("returns message without agent label when agent is null", async () => {
		const sdk: BackgroundSdkOperations = {
			promptAsync: async () => {},
		};

		const run = createSdkRunner(sdk);
		const result = await run(
			createTaskRecord({ agent: null, model: "gpt-5.4", description: "plan work" }),
			new AbortController().signal,
		);

		expect(result).toBe(
			"Background task dispatched (gpt-5.4). Summary: plan work. Prompt delivered to child session.",
		);
	});

	test("returns message without model label when model is null", async () => {
		const sdk: BackgroundSdkOperations = {
			promptAsync: async () => {},
		};

		const run = createSdkRunner(sdk);
		const result = await run(
			createTaskRecord({ agent: "planner", model: null, description: "plan work" }),
			new AbortController().signal,
		);

		expect(result).toBe(
			"Background task dispatched via planner. Summary: plan work. Prompt delivered to child session.",
		);
	});

	test("throws immediately when signal is already aborted", async () => {
		let called = false;
		const sdk: BackgroundSdkOperations = {
			promptAsync: async () => {
				called = true;
			},
		};

		const controller = new AbortController();
		controller.abort(new Error("stop"));

		const run = createSdkRunner(sdk);
		await expect(run(createTaskRecord(), controller.signal)).rejects.toThrow("stop");
		expect(called).toBe(false);
	});

	test("passes undefined for model when task.model is null", async () => {
		const calls: Array<{ model: string | undefined }> = [];
		const sdk: BackgroundSdkOperations = {
			promptAsync: async (_sessionId, model) => {
				calls.push({ model });
			},
		};

		const run = createSdkRunner(sdk);
		await run(createTaskRecord({ model: null }), new AbortController().signal);

		expect(calls).toEqual([{ model: undefined }]);
	});
});
