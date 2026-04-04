import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autopilotAgent } from "../../src/agents/autopilot";
import { loadLatestPipelineStateFromKernel } from "../../src/kernel/repository";
import { createInitialState, loadState, saveState } from "../../src/orchestrator/state";
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
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBe("oc-challenger");
		expect(parsed.phase).toBe("CHALLENGE");
	});

	test("returns stale error for mismatched runId", async () => {
		await orchestrateCore({ idea: "build a chat" }, tempDir);
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
		const first = JSON.parse(await orchestrateCore({ idea: "kind mismatch" }, tempDir));
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
		const first = JSON.parse(await orchestrateCore({ idea: "typed only" }, tempDir));
		const result = await orchestrateCore({ result: "Research findings: ..." }, tempDir);
		const parsed = JSON.parse(result);

		expect(first.action).toBe("dispatch");
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_INVALID_RESULT");
		expect(parsed.message).toContain("typed result envelope");
	});

	test("returns error when resuming with pending dispatch but no result provided", async () => {
		const first = JSON.parse(await orchestrateCore({ idea: "pending result" }, tempDir));
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

	test("prompt is lean (under 2500 chars)", () => {
		expect(autopilotAgent.prompt?.length).toBeLessThan(2500);
	});

	test("has maxSteps of 50", () => {
		expect((autopilotAgent as Record<string, unknown>).maxSteps).toBe(50);
	});
});
