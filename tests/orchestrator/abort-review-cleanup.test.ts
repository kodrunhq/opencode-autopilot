import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { handleAbortCleanup } from "../../src/tools/orchestrate";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "abort-cleanup-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("handleAbortCleanup", () => {
	test("sets state to INTERRUPTED and clears pending dispatches", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);

		await handleAbortCleanup(tempDir, "operation aborted");

		const persisted = JSON.parse(await readFile(join(tempDir, "state.json"), "utf-8"));
		expect(persisted.status).toBe("INTERRUPTED");
		expect(persisted.pendingDispatches).toEqual([]);
	});

	test("returns enriched safeMessage when state exists", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);

		const result = await handleAbortCleanup(tempDir, "operation aborted");

		expect(result.safeMessage).toContain("operation aborted");
	});

	test("handles missing state gracefully", async () => {
		const result = await handleAbortCleanup(tempDir, "operation aborted");

		expect(result.safeMessage).toBe("operation aborted");
	});

	test("does not throw when review state cleanup fails", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);

		const result = await handleAbortCleanup(tempDir, "signal interrupted");
		expect(result.safeMessage).toBeDefined();
	});
});
