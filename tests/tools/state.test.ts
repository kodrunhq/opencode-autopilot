import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { stateCore } from "../../src/tools/state";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "state-tool-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("stateCore", () => {
	test("load returns error when no state exists", async () => {
		const result = await stateCore({ subcommand: "load" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.error).toBe("no_state");
	});

	test("load returns full state JSON when state exists", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);
		const result = await stateCore({ subcommand: "load" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.idea).toBe("test idea");
		expect(parsed.schemaVersion).toBe(2);
	});

	test("get returns field value when state exists", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);
		const result = await stateCore({ subcommand: "get", field: "currentPhase" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.field).toBe("currentPhase");
		expect(parsed.value).toBe("RECON");
	});

	test("get returns error when field is missing", async () => {
		const result = await stateCore({ subcommand: "get" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.error).toBe("field required");
	});

	test("append-decision adds decision to state", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);
		const result = await stateCore(
			{
				subcommand: "append-decision",
				phase: "RECON",
				agent: "test",
				decision: "chose X",
				rationale: "because Y",
			},
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.ok).toBe(true);
		expect(parsed.decisions).toBe(1);
	});

	test("patch updates state fields", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);
		const result = await stateCore(
			{ subcommand: "patch", field: "status", value: "COMPLETED" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.ok).toBe(true);
	});

	test("unknown subcommand returns error", async () => {
		// @ts-expect-error — testing invalid subcommand
		const result = await stateCore({ subcommand: "nonexistent" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.error).toContain("unknown subcommand");
	});
});
