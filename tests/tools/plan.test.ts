import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import type { PipelineState } from "../../src/orchestrator/types";
import { planCore } from "../../src/tools/plan";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "plan-tool-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

function stateWithTasks(): PipelineState {
	const state = createInitialState("test idea");
	return {
		...state,
		tasks: [
			{ id: 1, title: "Task A", status: "DONE", wave: 1, attempt: 1, strike: 0 },
			{ id: 2, title: "Task B", status: "PENDING", wave: 1, attempt: 0, strike: 0 },
			{ id: 3, title: "Task C", status: "PENDING", wave: 2, attempt: 0, strike: 0 },
		],
	};
}

describe("planCore", () => {
	test("waves returns tasks grouped by wave", async () => {
		const state = stateWithTasks();
		await saveState(state, tempDir);
		const result = await planCore({ subcommand: "waves" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.waves).toBeDefined();
		expect(parsed.waves["1"]).toHaveLength(2);
		expect(parsed.waves["2"]).toHaveLength(1);
	});

	test("status-count returns task counts by status", async () => {
		const state = stateWithTasks();
		await saveState(state, tempDir);
		const result = await planCore({ subcommand: "status-count" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.DONE).toBe(1);
		expect(parsed.PENDING).toBe(2);
	});

	test("waves returns error when no state exists", async () => {
		const result = await planCore({ subcommand: "waves" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.error).toBeDefined();
	});
});
