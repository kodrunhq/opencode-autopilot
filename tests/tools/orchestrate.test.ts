import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autopilotAgent } from "../../src/agents/autopilot";
import { loadLatestPipelineStateFromKernel } from "../../src/kernel/repository";
import { clearAllRetryState, recordRetryAttempt } from "../../src/orchestrator/dispatch-retry";
import { createInitialState, loadState, saveState } from "../../src/orchestrator/state";
import { orchestrateCore } from "../../src/tools/orchestrate";
import { routeCore } from "../../src/tools/route";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "orchestrate-tool-test-"));
});

afterEach(async () => {
	clearAllRetryState();
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
		const result = await orchestrateCore(
			{ idea: "build a chat", intent: "implementation" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBe("oc-researcher");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.prompt).toContain("build a chat");
		// Verify state was created
		const stateRaw = await readFile(join(tempDir, "state.json"), "utf-8");
		const state = JSON.parse(stateRaw);
		expect(state.idea).toBe("build a chat");
		expect(loadLatestPipelineStateFromKernel(tempDir)?.idea).toBe("build a chat");
	});

	test("with state at RECON and result returns dispatch for next phase", async () => {
		const state = createInitialState("build a chat");
		await saveState(state, tempDir);
		const first = JSON.parse(await orchestrateCore({}, tempDir));
		const envelope = {
			schemaVersion: 1,
			resultId: "test-recon-1",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "research done" },
		};
		await mkdir(join(tempDir, "phases", "RECON"), { recursive: true });
		await writeFile(join(tempDir, "phases", "RECON", "report.md"), "# Report\ntest report");
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBe("oc-challenger");
		expect(parsed.phase).toBe("CHALLENGE");
	});

	test("returns stale error for mismatched runId", async () => {
		await orchestrateCore({ idea: "build a chat", intent: "implementation" }, tempDir);
		const result = await orchestrateCore(
			{
				result: JSON.stringify({
					schemaVersion: 1,
					resultId: "bad-run",
					runId: "other-run",
					phase: "RECON",
					dispatchId: "dispatch_x",
					agent: "oc-researcher",
					kind: "phase_output",
					taskId: null,
					payload: { text: "x" },
				}),
			},
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_STALE_RESULT");

		const logRaw = await readFile(join(tempDir, "orchestration.jsonl"), "utf-8");
		expect(logRaw).toContain("E_STALE_RESULT");
	});

	test("returns error when result kind does not match pending dispatch expectation", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "kind mismatch", intent: "implementation" }, tempDir),
		);
		const result = await orchestrateCore(
			{
				result: JSON.stringify({
					schemaVersion: 1,
					resultId: "kind-mismatch-1",
					runId: first.runId,
					phase: "RECON",
					dispatchId: first.dispatchId,
					agent: first.agent,
					kind: "task_completion",
					taskId: null,
					payload: { text: "wrong kind" },
				}),
			},
			tempDir,
		);
		const parsed = JSON.parse(result);

		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_RESULT_KIND_MISMATCH");
	});

	test("returns error when task completion omits required BUILD taskId against pending dispatch", async () => {
		const state = createInitialState("build kind checks");
		const buildState = {
			...state,
			currentPhase: "BUILD" as const,
			tasks: [
				{
					id: 1,
					title: "Task A",
					status: "IN_PROGRESS" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
			],
			buildProgress: {
				currentTask: 1,
				currentWave: 1,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			pendingDispatches: [
				{
					dispatchId: "dispatch_build_1",
					phase: "BUILD" as const,
					agent: "oc-implementer",
					issuedAt: new Date().toISOString(),
					resultKind: "task_completion" as const,
					taskId: 1,
				},
			],
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "BUILD"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(buildState, tempDir);

		const result = await orchestrateCore(
			{
				result: JSON.stringify({
					schemaVersion: 1,
					resultId: "build-missing-task-id",
					runId: buildState.runId,
					phase: "BUILD",
					dispatchId: "dispatch_build_1",
					agent: "oc-implementer",
					kind: "task_completion",
					taskId: null,
					payload: { text: "done" },
				}),
			},
			tempDir,
		);
		const parsed = JSON.parse(result);

		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_PHASE_MISMATCH");
		expect(parsed.message).toContain("taskId");
	});

	test("at final phase returns complete", async () => {
		const state = createInitialState("build a chat");
		// Set to RETROSPECTIVE (terminal phase)
		const terminalState = {
			...state,
			currentPhase: "RETROSPECTIVE" as const,
			phases: state.phases.map((p) =>
				p.name === "RETROSPECTIVE"
					? { ...p, status: "IN_PROGRESS" as const }
					: { ...p, status: "DONE" as const },
			),
		};
		await saveState(terminalState, tempDir);
		const first = JSON.parse(await orchestrateCore({}, tempDir));
		const result = await orchestrateCore(
			{
				result: JSON.stringify({
					schemaVersion: 1,
					resultId: "retro-typed-1",
					runId: first.runId,
					phase: "RETROSPECTIVE",
					dispatchId: first.dispatchId,
					agent: first.agent,
					kind: "phase_output",
					taskId: null,
					payload: { text: "retro done" },
				}),
			},
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("complete");
		expect(parsed.summary).toBeDefined();

		const saved = await loadState(tempDir);
		expect(saved?.status).toBe("COMPLETED");
		expect(saved?.currentPhase).toBeNull();
		expect(saved?.pendingDispatches).toEqual([]);
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

	test("returns error when raw string result is provided instead of typed envelope", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "typed only", intent: "implementation" }, tempDir),
		);
		const result = await orchestrateCore({ result: "Research findings: ..." }, tempDir);
		const parsed = JSON.parse(result);

		expect(first.action).toBe("dispatch");
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_INVALID_RESULT");
		expect(parsed.message).toContain("typed result envelope");
	});

	test("returns error when resuming with pending dispatch but no result provided", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "pending result", intent: "implementation" }, tempDir),
		);
		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);

		expect(first.action).toBe("dispatch");
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_PENDING_RESULT_REQUIRED");
		expect(parsed.message).toContain("Pending result required");
	});

	test("catch block converts thrown errors to error response", async () => {
		await mkdir(tempDir, { recursive: true });
		await writeFile(join(tempDir, "state.json"), "NOT VALID JSON{{{", "utf-8");
		const result = await orchestrateCore({ result: "done" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.message).toBeDefined();
	});

	test("rejects non-implementation intent with routing guidance", async () => {
		const result = await orchestrateCore(
			{ idea: "explain how auth works", intent: "research" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_INTENT_NOT_IMPLEMENTATION");
		expect(parsed.message).toContain("research");
		expect(parsed.message).toContain("researcher");
		expect(parsed.message).not.toContain("oc_orchestrate");
	});

	test("allows implementation intent to start pipeline normally", async () => {
		const result = await orchestrateCore(
			{ idea: "add dark mode", intent: "implementation" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.agent).toBe("oc-researcher");
	});

	test("rejects omitted intent with E_INTENT_REQUIRED", async () => {
		const result = await orchestrateCore({ idea: "build a widget" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_INTENT_REQUIRED");
		expect(parsed.message).toContain("oc_route");
	});

	test("rejects fix intent with debugger routing guidance", async () => {
		const result = await orchestrateCore({ idea: "fix the login bug", intent: "fix" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_INTENT_NOT_IMPLEMENTATION");
		expect(parsed.message).toContain("debugger");
	});

	test("rejects open_ended intent from starting pipeline", async () => {
		const result = await orchestrateCore(
			{ idea: "make things better", intent: "open_ended" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_INTENT_NOT_IMPLEMENTATION");
		expect(parsed.message).toContain("autopilot");
		expect(parsed.message).toContain("Assess");
	});

	test("intent guard does not affect result-based calls (existing pipeline)", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "test project", intent: "implementation" }, tempDir),
		);
		expect(first.action).toBe("dispatch");

		const envelope = {
			schemaVersion: 1,
			resultId: "intent-guard-resume",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "research complete" },
		};
		await mkdir(join(tempDir, "phases", "RECON"), { recursive: true });
		await writeFile(join(tempDir, "phases", "RECON", "report.md"), "# Report\ntest report");
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("CHALLENGE");
	});
});

describe("autopilotAgent", () => {
	test("has mode all", () => {
		expect(autopilotAgent.mode).toBe("all");
	});

	test("prompt contains oc_orchestrate", () => {
		expect(autopilotAgent.prompt).toContain("oc_orchestrate");
	});

	test("prompt requires typed result envelopes instead of raw outputs", () => {
		expect(autopilotAgent.prompt).toContain("typed result envelope");
		expect(autopilotAgent.prompt).not.toContain(
			"ALWAYS pass the full agent output back as the result parameter.",
		);
	});

	test("prompt is lean (under 10000 chars)", () => {
		expect(autopilotAgent.prompt?.length).toBeLessThan(10000);
	});

	test("has maxSteps of 50", () => {
		expect((autopilotAgent as Record<string, unknown>).maxSteps).toBe(50);
	});
});

describe("integration: routeCore → orchestrateCore", () => {
	test("research route output prevents pipeline start", async () => {
		const route = JSON.parse(
			routeCore({
				primaryIntent: "research",
				reasoning: "User asked how auth works",
				verbalization: "I detect research intent",
			}),
		);
		expect(route.action).toBe("route");
		expect(route.usePipeline).toBe(false);

		const pipeline = JSON.parse(
			await orchestrateCore({ idea: "how does auth work", intent: "research" }, tempDir),
		);
		expect(pipeline.action).toBe("error");
		expect(pipeline.code).toBe("E_INTENT_NOT_IMPLEMENTATION");
		expect(pipeline.message).toContain(route.targetAgent);
	});

	test("implementation route output allows pipeline start", async () => {
		const route = JSON.parse(
			routeCore({
				primaryIntent: "implementation",
				reasoning: "User wants to build a feature",
				verbalization: "I detect implementation intent",
			}),
		);
		expect(route.action).toBe("route");
		expect(route.usePipeline).toBe(true);

		const pipeline = JSON.parse(
			await orchestrateCore({ idea: "add dark mode", intent: "implementation" }, tempDir),
		);
		expect(pipeline.action).toBe("dispatch");
		expect(pipeline.phase).toBe("RECON");
	});

	test("fix route output prevents pipeline start and routes to debugger", async () => {
		const route = JSON.parse(
			routeCore({
				primaryIntent: "fix",
				reasoning: "User reports a bug",
				verbalization: "I detect fix intent",
			}),
		);
		expect(route.usePipeline).toBe(false);
		expect(route.targetAgent).toBe("debugger");

		const pipeline = JSON.parse(
			await orchestrateCore({ idea: "login is broken", intent: "fix" }, tempDir),
		);
		expect(pipeline.action).toBe("error");
		expect(pipeline.code).toBe("E_INTENT_NOT_IMPLEMENTATION");
		expect(pipeline.message).toContain("debugger");
	});
});

describe("active pipeline intent guard", () => {
	test("rejects non-implementation intent on active pipeline", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "build a widget", intent: "implementation" }, tempDir),
		);
		expect(first.action).toBe("dispatch");

		const result = await orchestrateCore(
			{ idea: "actually just research this", intent: "research" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_INTENT_NOT_IMPLEMENTATION");
		expect(parsed.message).toContain("researcher");
	});

	test("allows implementation intent on active pipeline (passes intent guards)", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "build a widget", intent: "implementation" }, tempDir),
		);
		expect(first.action).toBe("dispatch");

		const result = await orchestrateCore(
			{ idea: "actually build a better widget", intent: "implementation" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.code).not.toBe("E_INTENT_REQUIRED");
		expect(parsed.code).not.toBe("E_INTENT_NOT_IMPLEMENTATION");
	});

	test("rejects new idea without intent on active pipeline", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "build a widget", intent: "implementation" }, tempDir),
		);
		expect(first.action).toBe("dispatch");

		// Send a new idea WITHOUT intent on active pipeline — should be rejected
		const result = await orchestrateCore({ idea: "do something else" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_INTENT_REQUIRED");
		expect(parsed.message).toContain("intent classification");
	});

	test("result-based resume with no intent passes through (intent not checked on result)", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "build a widget", intent: "implementation" }, tempDir),
		);
		expect(first.action).toBe("dispatch");

		const envelope = {
			schemaVersion: 1,
			resultId: "no-intent-resume",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "done" },
		};
		await mkdir(join(tempDir, "phases", "RECON"), { recursive: true });
		await writeFile(join(tempDir, "phases", "RECON", "report.md"), "# Report\ntest report");
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("CHALLENGE");
	});

	test("result-based resume with stray non-implementation intent is NOT rejected", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "build a widget", intent: "implementation" }, tempDir),
		);
		expect(first.action).toBe("dispatch");

		const envelope = {
			schemaVersion: 1,
			resultId: "stray-intent-resume",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "research complete" },
		};
		await mkdir(join(tempDir, "phases", "RECON"), { recursive: true });
		await writeFile(join(tempDir, "phases", "RECON", "report.md"), "# Report\ntest report");
		const result = await orchestrateCore(
			{ result: JSON.stringify(envelope), intent: "research" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.code).not.toBe("E_INTENT_NOT_IMPLEMENTATION");
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("CHALLENGE");
	});
});

describe("orchestrateCore retry exhaustion", () => {
	test("returns handler error after retry limit is exhausted via real orchestrateCore path", async () => {
		// 1. Start a pipeline — get RECON dispatch
		const first = JSON.parse(
			await orchestrateCore({ idea: "retry exhaustion test", intent: "implementation" }, tempDir),
		);
		expect(first.action).toBe("dispatch");
		expect(first.phase).toBe("RECON");
		expect(first.agent).toBe("oc-researcher");

		// 2. Pre-seed retry state so attempts == maxRetries (default 2).
		//    This makes decideRetry() return shouldRetry: false on the next failure.
		recordRetryAttempt(first.dispatchId, "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt(first.dispatchId, "RECON", "oc-researcher", "rate_limit");

		// 3. Submit a result envelope whose payload triggers detectDispatchFailure.
		//    Do NOT create report.md — the RECON handler should surface an error
		//    because the artifact is missing after the failure summary is passed in.
		const errorEnvelope = {
			schemaVersion: 1,
			resultId: "retry-exhaust-1",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: "oc-researcher",
			kind: "phase_output",
			taskId: null,
			payload: { text: "rate limit exceeded" },
		};
		const result = await orchestrateCore({ result: JSON.stringify(errorEnvelope) }, tempDir);
		const parsed = JSON.parse(result);

		// 4. The RECON handler receives the failure summary as its result input,
		//    sees that report.md doesn't exist, and returns action: "error".
		expect(parsed.action).toBe("error");

		// 5. Verify the orchestration log captured the dispatch failure event.
		const logRaw = await readFile(join(tempDir, "orchestration.jsonl"), "utf-8");
		expect(logRaw).toContain("Dispatch failure detected");
	});
});
