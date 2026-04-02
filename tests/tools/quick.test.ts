import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "quick-tool-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("quickCore", () => {
	test("creates initial state with currentPhase set to PLAN", async () => {
		const { quickCore } = await import("../../src/tools/quick");
		const result = await quickCore({ idea: "fix typo in README" }, tempDir);
		const stateRaw = await readFile(join(tempDir, "state.json"), "utf-8");
		const state = JSON.parse(stateRaw);
		expect(state.currentPhase).toBe("PLAN");
	});

	test("marks RECON, CHALLENGE, ARCHITECT, EXPLORE as SKIPPED with completedAt", async () => {
		const { quickCore } = await import("../../src/tools/quick");
		await quickCore({ idea: "fix typo in README" }, tempDir);
		const stateRaw = await readFile(join(tempDir, "state.json"), "utf-8");
		const state = JSON.parse(stateRaw);
		const skippedPhases = ["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE"];
		for (const phaseName of skippedPhases) {
			const phase = state.phases.find(
				(p: { name: string; status: string }) => p.name === phaseName,
			);
			expect(phase.status).toBe("SKIPPED");
			expect(phase.completedAt).toBeTruthy();
		}
	});

	test("marks PLAN as IN_PROGRESS in the phases array", async () => {
		const { quickCore } = await import("../../src/tools/quick");
		await quickCore({ idea: "fix typo in README" }, tempDir);
		const stateRaw = await readFile(join(tempDir, "state.json"), "utf-8");
		const state = JSON.parse(stateRaw);
		const planPhase = state.phases.find(
			(p: { name: string; status: string }) => p.name === "PLAN",
		);
		expect(planPhase.status).toBe("IN_PROGRESS");
	});

	test("returns error when idea is not provided", async () => {
		const { quickCore } = await import("../../src/tools/quick");
		const result = await quickCore({ idea: "" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.message).toContain("idea");
	});

	test("returns error when existing run is IN_PROGRESS", async () => {
		const { quickCore } = await import("../../src/tools/quick");
		const existingState = createInitialState("existing task");
		await saveState(existingState, tempDir);
		const result = await quickCore({ idea: "new task" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.message).toContain("already in progress");
	});

	test("calls orchestrateCore after creating skip-ahead state and returns its result", async () => {
		const { quickCore } = await import("../../src/tools/quick");
		const result = await quickCore({ idea: "fix typo in README" }, tempDir);
		// orchestrateCore should load state, see PLAN as current phase, and dispatch oc-planner
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBe("oc-planner");
		expect(parsed.phase).toBe("PLAN");
	});

	test("sets status to IN_PROGRESS in the saved state", async () => {
		const { quickCore } = await import("../../src/tools/quick");
		await quickCore({ idea: "fix typo in README" }, tempDir);
		const stateRaw = await readFile(join(tempDir, "state.json"), "utf-8");
		const state = JSON.parse(stateRaw);
		expect(state.status).toBe("IN_PROGRESS");
	});
});
