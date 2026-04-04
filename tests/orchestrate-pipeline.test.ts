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
		const first = JSON.parse(await orchestrateCore({}, tempDir));
		const envelope = {
			schemaVersion: 1,
			resultId: "pipe-recon-1",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "recon findings complete" },
		};

		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
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

		const first = JSON.parse(await orchestrateCore({}, tempDir));
		const envelope = {
			schemaVersion: 1,
			resultId: "pipe-challenge-1",
			runId: first.runId,
			phase: "CHALLENGE",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "challenge done" },
		};
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
		const parsed = JSON.parse(result);
		// CHALLENGE handler with result -> complete -> advance to ARCHITECT
		// ARCHITECT handler dispatches single (depth=1) with empty confidence (HIGH default)
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
				{
					id: 1,
					title: "Task A",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
				{
					id: 2,
					title: "Task B",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
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
			tasks: [
				{
					id: 1,
					title: "Task A",
					status: "DONE" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
			],
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

		// reviewCore is inlined, so a single orchestrate call should advance past BUILD
		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);
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

		const first = JSON.parse(await orchestrateCore({}, tempDir));
		const envelope = {
			schemaVersion: 1,
			resultId: "pipe-retro-1",
			runId: first.runId,
			phase: "RETROSPECTIVE",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "retro findings" },
		};
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
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

	test("circuit breaker returns error when phase exceeds max dispatches", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		const state = createInitialState("test idea");
		// Pre-set dispatch count to just under the RECON limit (3)
		const preloaded = {
			...state,
			phaseDispatchCounts: { RECON: 3 },
		};
		await saveState(preloaded, tempDir);

		// Next dispatch should exceed the limit
		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.message).toContain("exceeded max dispatches");
		expect(parsed.message).toContain("RECON");
	});

	test("_userProgress contains phase number and name for RECON dispatch", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		const result = await orchestrateCore({ idea: "build a chat app" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed._userProgress).toBeDefined();
		expect(parsed._userProgress).toContain("Phase 1/8");
		expect(parsed._userProgress).toContain("RECON");
	});

	test("_userProgress contains Completed and 8/8 for terminal phase", async () => {
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

		const first = JSON.parse(await orchestrateCore({}, tempDir));
		const envelope = {
			schemaVersion: 1,
			resultId: "pipe-retro-2",
			runId: first.runId,
			phase: "RETROSPECTIVE",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "retro done" },
		};
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed._userProgress).toBeDefined();
		expect(parsed._userProgress).toContain("Completed");
		expect(parsed._userProgress).toContain("8/8");
	});

	test("_userProgress contains Phase and phase name for dispatch_multi", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		const state = createInitialState("test idea");
		const buildState = {
			...state,
			currentPhase: "BUILD" as Phase,
			tasks: [
				{
					id: 1,
					title: "Task A",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
				{
					id: 2,
					title: "Task B",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
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
		expect(parsed._userProgress).toBeDefined();
		expect(parsed._userProgress).toContain("Phase");
		expect(parsed._userProgress).toContain("BUILD");
	});

	test("JSONL logging side-effect: orchestration.jsonl contains dispatch event", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		await orchestrateCore({ idea: "build a chat app" }, tempDir);

		const logPath = join(tempDir, "orchestration.jsonl");
		const content = await readFile(logPath, "utf-8");
		const lines = content.trim().split("\n").filter(Boolean);
		expect(lines.length).toBeGreaterThanOrEqual(1);

		const hasDispatch = lines.some((line) => {
			const entry = JSON.parse(line);
			return entry.action === "dispatch" && entry.phase === "RECON";
		});
		expect(hasDispatch).toBe(true);
	});

	test("circuit breaker dispatch_multi path returns error at limit", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		const state = createInitialState("test idea");
		// ARCHITECT with MEDIUM confidence triggers dispatch_multi (depth=2).
		// Pre-set dispatch count to the ARCHITECT limit (10) so next dispatch is blocked.
		const archState = {
			...state,
			currentPhase: "ARCHITECT" as Phase,
			confidence: [
				{
					timestamp: new Date().toISOString(),
					phase: "RECON",
					agent: "oc-researcher",
					area: "feasibility",
					level: "MEDIUM" as const,
					rationale: "some uncertainty",
				},
			],
			phaseDispatchCounts: { ARCHITECT: 10 },
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "ARCHITECT"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(archState, tempDir);

		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.message).toContain("exceeded max dispatches");
	});

	test("returns duplicate error when replaying same result envelope", async () => {
		const { orchestrateCore } = await import("../src/tools/orchestrate");
		const first = JSON.parse(await orchestrateCore({ idea: "dup test" }, tempDir));
		const envelope = JSON.stringify({
			schemaVersion: 1,
			resultId: "dup-1",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "done" },
		});

		await orchestrateCore({ result: envelope }, tempDir);
		const second = JSON.parse(await orchestrateCore({ result: envelope }, tempDir));
		expect(second.action).toBe("error");
		expect(second.code).toBe("E_DUPLICATE_RESULT");
	});
});

// ---- configHook pipeline agent registration tests ----

describe("configHook pipeline agents", () => {
	test("registers all 10 pipeline agents in config", async () => {
		const { configHook } = await import("../src/agents/index");
		const config = { agent: {} } as import("@opencode-ai/plugin").Config;
		await configHook(config);

		expect(config.agent).toBeDefined();
		const agents = config.agent as Record<string, unknown>;
		const pipelineNames = Object.values(AGENT_NAMES);
		for (const name of pipelineNames) {
			expect(agents[name]).toBeDefined();
		}
	});

	test("registers v1 agents alongside pipeline agents", async () => {
		const { configHook } = await import("../src/agents/index");
		const config = { agent: {} } as import("@opencode-ai/plugin").Config;
		await configHook(config);

		expect(config.agent).toBeDefined();
		const agents = config.agent as Record<string, unknown>;
		// standard agents
		expect(agents.researcher).toBeDefined();
		expect(agents.metaprompter).toBeDefined();
		expect(agents.documenter).toBeDefined();
		expect(agents["pr-reviewer"]).toBeDefined();
		expect(agents.autopilot).toBeDefined();
		expect(agents.debugger).toBeDefined();
		expect(agents.planner).toBeDefined();
		expect(agents.reviewer).toBeDefined();
		expect(agents.coder).toBeDefined();

		// pipeline agents
		expect(agents["oc-researcher"]).toBeDefined();
		expect(agents["oc-implementer"]).toBeDefined();

		// new subagent agents
		expect(agents["db-specialist"]).toBeDefined();
		expect(agents.devops).toBeDefined();
		expect(agents["frontend-engineer"]).toBeDefined();
		expect(agents["security-auditor"]).toBeDefined();

		// Total: 13 standard + 10 pipeline = 23
		expect(Object.keys(agents).length).toBe(23);
	});

	test("pipeline agents have mode subagent", async () => {
		const { configHook } = await import("../src/agents/index");
		const config = { agent: {} } as import("@opencode-ai/plugin").Config;
		await configHook(config);

		expect(config.agent).toBeDefined();
		const agents = config.agent as Record<string, Record<string, unknown>>;
		const pipelineNames = Object.values(AGENT_NAMES);
		for (const name of pipelineNames) {
			expect(agents[name].mode).toBe("subagent");
		}
	});

	test("preserves user customizations (does not overwrite pre-set agent)", async () => {
		const { configHook } = await import("../src/agents/index");
		const customAgent = { prompt: "my custom researcher", mode: "primary" };
		const config = {
			agent: { "oc-researcher": customAgent },
		} as unknown as import("@opencode-ai/plugin").Config;
		await configHook(config);

		expect(config.agent).toBeDefined();
		const agents = config.agent as Record<string, Record<string, unknown>>;
		// Should preserve user's custom config
		expect(agents["oc-researcher"].prompt).toBe("my custom researcher");
		expect(agents["oc-researcher"].mode).toBe("primary");
		// Other pipeline agents still registered
		expect(agents["oc-implementer"]).toBeDefined();
	});
});
