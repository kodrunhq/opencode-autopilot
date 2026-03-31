import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_NAMES } from "../src/orchestrator/handlers/types";
import { PHASES } from "../src/orchestrator/schemas";
import { createInitialState, saveState } from "../src/orchestrator/state";
import type { Phase } from "../src/orchestrator/types";

// ---- PHASE_HANDLERS tests ----

describe("PHASE_HANDLERS", () => {
	test("has entries for all 8 phases", async () => {
		const { PHASE_HANDLERS } = await import("../src/orchestrator/handlers/index");
		for (const phase of PHASES) {
			expect(PHASE_HANDLERS[phase]).toBeDefined();
			expect(typeof PHASE_HANDLERS[phase]).toBe("function");
		}
		expect(Object.keys(PHASE_HANDLERS)).toHaveLength(8);
	});
});

// ---- orchestrateCore pipeline integration tests ----

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "orch-pipeline-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("orchestrateCore pipeline dispatch", () => {
	test("with idea creates state and dispatches via handleRecon", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		const result = await orchestrateCore({ idea: "build a chat app" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBe("oc-researcher");
		expect(parsed.phase).toBe("RECON");
		// Should contain idea context (from handler, not generic prompt)
		expect(parsed.prompt).toContain("build a chat app");
		// Verify state was persisted
		const stateRaw = await readFile(join(tempDir, "state.json"), "utf-8");
		const state = JSON.parse(stateRaw);
		expect(state.idea).toBe("build a chat app");
		expect(state.currentPhase).toBe("RECON");
	});

	test("with result delegates to current phase handler", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		const state = createInitialState("test idea");
		await saveState(state, tempDir);

		const result = await orchestrateCore({ result: "recon findings complete" }, tempDir);
		const parsed = JSON.parse(result);
		// RECON handler with result returns complete, then orchestrateCore should advance
		// After RECON complete, it should dispatch CHALLENGE
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("CHALLENGE");
	});

	test("handler returning complete advances to next phase", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		// Set state at CHALLENGE
		const state = createInitialState("test idea");
		const challengeState = {
			...state,
			currentPhase: "CHALLENGE" as Phase,
			phases: state.phases.map((p) =>
				p.name === "RECON"
					? { ...p, status: "DONE" as const }
					: p.name === "CHALLENGE"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(challengeState, tempDir);

		const result = await orchestrateCore({ result: "challenge done" }, tempDir);
		const parsed = JSON.parse(result);
		// CHALLENGE handler with result -> complete -> advance to ARCHITECT
		// ARCHITECT handler dispatches multi (Arena) by default
		expect(["dispatch", "dispatch_multi"]).toContain(parsed.action);
		expect(parsed.phase).toBe("ARCHITECT");
	});

	test("handler returning dispatch returns dispatch JSON directly", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		// Set state at PLAN with no result -> handler dispatches planner agent
		const state = createInitialState("test idea");
		const planState = {
			...state,
			currentPhase: "PLAN" as Phase,
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "PLAN"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(planState, tempDir);

		// No result = resume -> handler should dispatch
		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBeDefined();
	});

	test("handler returning dispatch_multi returns dispatch_multi JSON", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		// Set state at BUILD with tasks in a multi-task wave
		const state = createInitialState("test idea");
		const buildState = {
			...state,
			currentPhase: "BUILD" as Phase,
			tasks: [
				{ id: 1, title: "Task A", status: "PENDING" as const, wave: 1, attempt: 0, strike: 0 },
				{ id: 2, title: "Task B", status: "PENDING" as const, wave: 1, attempt: 0, strike: 0 },
			],
			buildProgress: {
				currentTask: null,
				currentWave: null,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "BUILD"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(buildState, tempDir);

		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch_multi");
		expect(parsed.agents).toBeDefined();
		expect(parsed.agents.length).toBe(2);
	});

	test("BUILD phase with reviewPending triggers reviewCore directly", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		// BUILD state with wave complete, review dispatched, result comes back (no critical)
		const state = createInitialState("test idea");
		const buildState = {
			...state,
			currentPhase: "BUILD" as Phase,
			tasks: [{ id: 1, title: "Task A", status: "DONE" as const, wave: 1, attempt: 0, strike: 0 }],
			buildProgress: {
				currentTask: null,
				currentWave: 1,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: true,
			},
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "BUILD"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(buildState, tempDir);

		// When BUILD handler dispatches "oc-review", orchestrateCore should call reviewCore
		// For the purpose of this test, the handler's result with reviewPending=true
		// and a non-critical result should advance (complete BUILD)
		const result = await orchestrateCore({ result: '{"findings":[]}' }, tempDir);
		const parsed = JSON.parse(result);
		// After review passes (no critical), BUILD should complete and advance to SHIP
		expect(["dispatch", "complete"]).toContain(parsed.action);
	});

	test("terminal phase (RETROSPECTIVE) completion returns pipeline complete", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		const state = createInitialState("test idea");
		const retroState = {
			...state,
			currentPhase: "RETROSPECTIVE" as Phase,
			phases: state.phases.map((p) =>
				p.name === "RETROSPECTIVE"
					? { ...p, status: "IN_PROGRESS" as const }
					: { ...p, status: "DONE" as const },
			),
		};
		await saveState(retroState, tempDir);

		const result = await orchestrateCore({ result: "retro findings" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("complete");
	});

	test("resume (no result, active state) delegates to current phase handler", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		const state = createInitialState("test idea");
		await saveState(state, tempDir);

		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.agent).toBe("oc-researcher");
	});
});

// ---- configHook pipeline agent registration tests ----

describe("configHook pipeline agents", () => {
	test("registers all 9 pipeline agents in config", async () => {
		const { configHook } = await import("../src/agents/index");
		const config = { agent: {} } as import("@opencode-ai/plugin").Config;
		await configHook(config);

		const pipelineNames = Object.values(AGENT_NAMES);
		for (const name of pipelineNames) {
			expect(config.agent[name]).toBeDefined();
		}
	});

	test("registers v1 agents alongside pipeline agents", async () => {
		const { configHook } = await import("../src/agents/index");
		const config = { agent: {} } as import("@opencode-ai/plugin").Config;
		await configHook(config);

		// v1 agents
		expect(config.agent.researcher).toBeDefined();
		expect(config.agent.metaprompter).toBeDefined();
		expect(config.agent.documenter).toBeDefined();
		expect(config.agent["pr-reviewer"]).toBeDefined();
		expect(config.agent.orchestrator).toBeDefined();

		// pipeline agents
		expect(config.agent["oc-researcher"]).toBeDefined();
		expect(config.agent["oc-implementer"]).toBeDefined();

		// Total: 5 v1 + 10 pipeline = 15
		expect(Object.keys(config.agent).length).toBe(15);
	});

	test("pipeline agents have mode subagent", async () => {
		const { configHook } = await import("../src/agents/index");
		const config = { agent: {} } as import("@opencode-ai/plugin").Config;
		await configHook(config);

		const pipelineNames = Object.values(AGENT_NAMES);
		for (const name of pipelineNames) {
			const agent = config.agent[name] as Record<string, unknown>;
			expect(agent.mode).toBe("subagent");
		}
	});

	test("preserves user customizations (does not overwrite pre-set agent)", async () => {
		const { configHook } = await import("../src/agents/index");
		const customAgent = { prompt: "my custom researcher", mode: "primary" };
		const config = {
			agent: { "oc-researcher": customAgent },
		} as unknown as import("@opencode-ai/plugin").Config;
		await configHook(config);

		// Should preserve user's custom config
		expect((config.agent["oc-researcher"] as Record<string, unknown>).prompt).toBe(
			"my custom researcher",
		);
		expect((config.agent["oc-researcher"] as Record<string, unknown>).mode).toBe("primary");
		// Other pipeline agents still registered
		expect(config.agent["oc-implementer"]).toBeDefined();
	});
});
