import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { phaseCore } from "../../src/tools/phase";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "phase-tool-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("phaseCore", () => {
	test("status returns current phase info", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);
		const result = await phaseCore({ subcommand: "status" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.currentPhase).toBe("RECON");
		expect(parsed.status).toBe("IN_PROGRESS");
	});

	test("complete advances phase and saves state", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);
		const result = await phaseCore({ subcommand: "complete" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.ok).toBe(true);
		expect(parsed.previousPhase).toBe("RECON");
		expect(parsed.currentPhase).toBe("CHALLENGE");
	});

	test("validate returns valid:true for valid transition", async () => {
		const result = await phaseCore(
			{ subcommand: "validate", from: "RECON", to: "CHALLENGE" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.valid).toBe(true);
	});

	test("validate returns valid:false for invalid transition", async () => {
		const result = await phaseCore({ subcommand: "validate", from: "RECON", to: "BUILD" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.valid).toBe(false);
		expect(parsed.error).toBeDefined();
	});

	test("status returns error when no state exists", async () => {
		const result = await phaseCore({ subcommand: "status" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.error).toBeDefined();
	});

	test("unknown subcommand returns error", async () => {
		const result = await phaseCore({ subcommand: "nonexistent" as unknown }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.error).toContain("unknown subcommand");
	});

	test("status with completed pipeline returns currentPhase null", async () => {
		const state = createInitialState("test idea");
		const completedState = {
			...state,
			currentPhase: null as null,
			status: "COMPLETED" as const,
		};
		await saveState(completedState, tempDir);
		const result = await phaseCore({ subcommand: "status" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.currentPhase).toBeNull();
		expect(parsed.status).toBe("COMPLETED");
	});
});
