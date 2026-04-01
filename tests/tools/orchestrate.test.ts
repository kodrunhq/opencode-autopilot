import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autopilotAgent } from "../../src/agents/autopilot";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { orchestrateCore } from "../../src/tools/orchestrate";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "orchestrate-tool-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("orchestrateCore", () => {
	test("with no state and no idea returns error", async () => {
		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.message).toBe("No active run. Provide an idea to start.");
	});

	test("with no state and idea creates state and returns dispatch", async () => {
		const result = await orchestrateCore({ idea: "build a chat" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBe("oc-researcher");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.prompt).toContain("build a chat");
		// Verify state was created
		const stateRaw = await readFile(join(tempDir, "state.json"), "utf-8");
		const state = JSON.parse(stateRaw);
		expect(state.idea).toBe("build a chat");
	});

	test("with state at RECON and result returns dispatch for next phase", async () => {
		const state = createInitialState("build a chat");
		await saveState(state, tempDir);
		const result = await orchestrateCore({ result: "research done" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBe("oc-challenger");
		expect(parsed.phase).toBe("CHALLENGE");
	});

	test("at final phase returns complete", async () => {
		const state = createInitialState("build a chat");
		// Set to RETROSPECTIVE (terminal phase)
		const terminalState = {
			...state,
			currentPhase: "RETROSPECTIVE" as const,
			phases: state.phases.map((p) =>
				p.name === "RETROSPECTIVE" ? { ...p, status: "IN_PROGRESS" as const } : p,
			),
		};
		await saveState(terminalState, tempDir);
		const result = await orchestrateCore({ result: "retro done" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("complete");
		expect(parsed.summary).toBeDefined();
	});

	test("resumes at current phase when state exists but no result/idea provided", async () => {
		const state = createInitialState("build a chat");
		await saveState(state, tempDir);
		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");
	});

	test("already-complete pipeline returns complete when result arrives late", async () => {
		const state = createInitialState("build a chat");
		const completedState = {
			...state,
			currentPhase: null as null,
			status: "COMPLETED" as const,
		};
		await saveState(completedState, tempDir);
		const result = await orchestrateCore({ result: "late result" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("complete");
	});

	test("catch block converts thrown errors to error response", async () => {
		await mkdir(tempDir, { recursive: true });
		await writeFile(join(tempDir, "state.json"), "NOT VALID JSON{{{", "utf-8");
		const result = await orchestrateCore({ result: "done" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.message).toBeDefined();
	});
});

describe("autopilotAgent", () => {
	test("has mode all", () => {
		expect(autopilotAgent.mode).toBe("all");
	});

	test("prompt contains oc_orchestrate", () => {
		expect(autopilotAgent.prompt).toContain("oc_orchestrate");
	});

	test("prompt is lean (under 2000 chars)", () => {
		expect(autopilotAgent.prompt?.length).toBeLessThan(2000);
	});

	test("has maxSteps of 50", () => {
		expect((autopilotAgent as Record<string, unknown>).maxSteps).toBe(50);
	});
});
