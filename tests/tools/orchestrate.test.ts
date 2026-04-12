import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autopilotAgent } from "../../src/agents/autopilot";
import { loadLatestPipelineStateFromKernel } from "../../src/kernel/repository";
import { resetDedupCache } from "../../src/observability/forensic-log";
import { getPhaseDir } from "../../src/orchestrator/artifacts";
import { clearAllRetryState, recordRetryAttempt } from "../../src/orchestrator/dispatch-retry";
import { formatOracleSignoffEnvelope } from "../../src/orchestrator/signoff";
import { createInitialState, loadState, saveState } from "../../src/orchestrator/state";
import type { PendingDispatch } from "../../src/orchestrator/types";
import {
	buildPipelineIdeaForTranche,
	loadLatestProgramRunFromKernel,
	markCurrentTrancheShipped,
	planProgramRunFromRequest,
	saveProgramRunToKernel,
} from "../../src/program";
import { ocOrchestrate, orchestrateCore } from "../../src/tools/orchestrate";
import { ocRoute, routeCore } from "../../src/tools/route";

let tempDir: string;

function makePendingDispatch(overrides: Partial<PendingDispatch> = {}): PendingDispatch {
	const callerSessionId = overrides.callerSessionId ?? overrides.sessionId ?? null;
	return {
		dispatchId: overrides.dispatchId ?? "dispatch_test",
		phase: overrides.phase ?? "RECON",
		agent: overrides.agent ?? "oc-researcher",
		issuedAt: overrides.issuedAt ?? new Date().toISOString(),
		status: overrides.status ?? "PENDING",
		receivedResultId: overrides.receivedResultId ?? null,
		receivedAt: overrides.receivedAt ?? null,
		resultKind: overrides.resultKind ?? "phase_output",
		taskId: overrides.taskId ?? null,
		callerSessionId,
		spawnedSessionId: overrides.spawnedSessionId ?? null,
		sessionId: callerSessionId,
	};
}

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "orchestrate-tool-test-"));
	resetDedupCache();
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
		const reconDir = getPhaseDir(tempDir, "RECON", first.runId);
		await mkdir(reconDir, { recursive: true });
		await writeFile(join(reconDir, "report.md"), "# Report\ntest report");
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBe("oc-challenger");
		expect(parsed.phase).toBe("CHALLENGE");
	});

	test("keeps a dispatch alive when a result arrives before its required artifact exists", async () => {
		const first = JSON.parse(
			await orchestrateCore(
				{ idea: "recover missing recon artifact", intent: "implementation" },
				tempDir,
			),
		);

		const envelope = {
			schemaVersion: 1,
			resultId: "recon-missing-artifact-1",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "research complete" },
		};

		const result = JSON.parse(await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir));
		expect(result.action).toBe("error");
		expect(result.phase).toBe("RECON");
		expect(result.message).toContain("did not write the required artifact");
		expect(result.stopClassification).toBeUndefined();

		const saved = await loadState(tempDir);
		const pending = saved?.pendingDispatches.find(
			(dispatch) => dispatch.dispatchId === first.dispatchId,
		);
		expect(saved?.status).toBe("IN_PROGRESS");
		expect(pending).toMatchObject({
			dispatchId: first.dispatchId,
			status: "FAILED_RECOVERABLE",
			receivedResultId: envelope.resultId,
		});
		expect(pending?.receivedAt).toEqual(expect.any(String));
	});

	test("accepts a resubmitted result on the original dispatch after the artifact is created", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "retry recon artifact", intent: "implementation" }, tempDir),
		);

		const missingArtifactEnvelope = {
			schemaVersion: 1,
			resultId: "recon-retry-1",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "research complete" },
		};

		await orchestrateCore({ result: JSON.stringify(missingArtifactEnvelope) }, tempDir);

		const reconDir = getPhaseDir(tempDir, "RECON", first.runId);
		await mkdir(reconDir, { recursive: true });
		await writeFile(join(reconDir, "report.md"), "# Report\ntransactional retry");

		const retriedEnvelope = {
			...missingArtifactEnvelope,
			resultId: "recon-retry-2",
		};
		const retried = JSON.parse(
			await orchestrateCore({ result: JSON.stringify(retriedEnvelope) }, tempDir),
		);

		expect(retried.action).toBe("dispatch");
		expect(retried.phase).toBe("CHALLENGE");
		expect(retried.agent).toBe("oc-challenger");

		const saved = await loadState(tempDir);
		expect(
			saved?.pendingDispatches.some((dispatch) => dispatch.dispatchId === first.dispatchId),
		).toBe(false);
		expect(saved?.processedResultIds).toContain("recon-retry-1");
		expect(saved?.processedResultIds).toContain("recon-retry-2");
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

	test("result processing never overwrites spawnedSessionId with caller session context", async () => {
		const state = createInitialState("preserve child session");
		await saveState(
			{
				...state,
				pendingDispatches: [
					makePendingDispatch({
						dispatchId: "dispatch_child_session",
						callerSessionId: "parent-session",
						spawnedSessionId: "child-session",
					}),
				],
			},
			tempDir,
		);

		const result = await orchestrateCore(
			{
				result: JSON.stringify({
					schemaVersion: 1,
					resultId: "child-session-stale-run",
					runId: "other-run",
					phase: "RECON",
					dispatchId: "dispatch_child_session",
					agent: "oc-researcher",
					kind: "phase_output",
					taskId: null,
					payload: { text: "ignored" },
				}),
			},
			tempDir,
			{
				sessionId: "parent-session",
				messageId: "msg-child-session",
				projectRoot: tempDir,
			},
		);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_STALE_RESULT");

		const persisted = await loadState(tempDir);
		expect(persisted?.pendingDispatches).toHaveLength(1);
		expect(persisted?.pendingDispatches[0]?.callerSessionId).toBe("parent-session");
		expect(persisted?.pendingDispatches[0]?.spawnedSessionId).toBe("child-session");
		expect(persisted?.pendingDispatches[0]?.sessionId).toBe("parent-session");
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
				currentTasks: [1],
				currentWave: 1,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
				oraclePending: false,
				oracleSignoffId: null,
				oracleInputsDigest: null,
				lastReviewReport: null,
			},
			pendingDispatches: [
				makePendingDispatch({
					dispatchId: "dispatch_build_1",
					phase: "BUILD",
					agent: "oc-implementer",
					resultKind: "task_completion",
					taskId: 1,
				}),
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

	test("starts a fresh run when the previous pipeline is already completed", async () => {
		const state = createInitialState("old idea");
		await saveState(
			{
				...state,
				currentPhase: null,
				status: "COMPLETED",
			},
			tempDir,
		);

		const result = await orchestrateCore({ idea: "new idea", intent: "implementation" }, tempDir);
		const parsed = JSON.parse(result);

		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.prompt).toContain("new idea");

		const saved = await loadState(tempDir);
		expect(saved?.idea).toBe("new idea");
		expect(saved?.status).toBe("IN_PROGRESS");
		expect(saved?.currentPhase).toBe("RECON");
	});

	test("starts a fresh run when the previous pipeline was interrupted", async () => {
		const state = createInitialState("abandoned idea");
		await saveState(
			{
				...state,
				status: "INTERRUPTED",
				pendingDispatches: [],
			},
			tempDir,
		);

		const result = await orchestrateCore(
			{ idea: "replacement idea", intent: "implementation" },
			tempDir,
		);
		const parsed = JSON.parse(result);

		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.prompt).toContain("replacement idea");

		const saved = await loadState(tempDir);
		expect(saved?.idea).toBe("replacement idea");
		expect(saved?.status).toBe("IN_PROGRESS");
		expect(saved?.currentPhase).toBe("RECON");
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

	test("completed pipeline can be replaced by a new implementation idea", async () => {
		const completed = createInitialState("old idea");
		await saveState({ ...completed, currentPhase: null, status: "COMPLETED" }, tempDir);

		const result = await orchestrateCore({ idea: "new idea", intent: "implementation" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");

		const state = await loadState(tempDir);
		expect(state?.idea).toBe("new idea");
		expect(state?.status).toBe("IN_PROGRESS");
		expect(state?.currentPhase).toBe("RECON");
	});

	test("interrupted pipeline can be replaced by a new implementation idea", async () => {
		const interrupted = createInitialState("stuck idea");
		await saveState({ ...interrupted, status: "INTERRUPTED", pendingDispatches: [] }, tempDir);

		const result = await orchestrateCore(
			{ idea: "replacement idea", intent: "implementation" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");

		const state = await loadState(tempDir);
		expect(state?.idea).toBe("replacement idea");
		expect(state?.status).toBe("IN_PROGRESS");
		expect(state?.currentPhase).toBe("RECON");
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
		const reconDir = getPhaseDir(tempDir, "RECON", first.runId);
		await mkdir(reconDir, { recursive: true });
		await writeFile(join(reconDir, "report.md"), "# Report\ntest report");
		const result = await orchestrateCore({ result: JSON.stringify(envelope) }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("CHALLENGE");
	});

	test("broad implementation requests start an autonomous multi-tranche program automatically", async () => {
		const broadIdea = [
			"Implement the remediation program:",
			"1. Add program and tranche persistence.",
			"2. Add autonomous tranche planning heuristics.",
			"3. Continue automatically across multiple PRs.",
			"Acceptance criteria:",
			"- Tranche 1 starts automatically.",
		].join("\n");

		const result = JSON.parse(
			await orchestrateCore({ idea: broadIdea, intent: "implementation" }, tempDir),
		);

		expect(result.action).toBe("dispatch");
		expect(result.phase).toBe("RECON");
		expect(result.program).toBeDefined();
		expect(result.program.trancheIndex).toBe(1);
		expect(result.program.trancheCount).toBeGreaterThan(1);
		expect(result.program.selectionRationale).toContain("Selected automatically");

		const state = await loadState(tempDir);
		expect(state?.programContext?.trancheIndex).toBe(1);
		expect(state?.programContext?.trancheCount).toBeGreaterThan(1);

		const program = loadLatestProgramRunFromKernel(tempDir);
		expect(program?.status).toBe("ACTIVE");
		expect(program?.tranches.length).toBeGreaterThan(1);
		expect(program?.tranches[0]?.status).toBe("IN_PROGRESS");
		expect(program?.tranches[1]?.status).toBe("PENDING");
	});

	test("successful ship queues the next tranche and retrospective completion starts it automatically", async () => {
		const broadIdea = [
			"Implement the remediation program:",
			"1. Add program and tranche persistence.",
			"2. Continue automatically across multiple PRs.",
		].join("\n");
		await orchestrateCore({ idea: broadIdea, intent: "implementation" }, tempDir);

		const activeState = await loadState(tempDir);
		if (!activeState?.programContext) {
			throw new Error("Expected initial run to create program context");
		}
		const initialProgram = loadLatestProgramRunFromKernel(tempDir);
		if (!initialProgram) {
			throw new Error("Expected initial run to persist a program");
		}

		const queuedProgram = markCurrentTrancheShipped(initialProgram, "manifest_run_1");
		saveProgramRunToKernel(tempDir, queuedProgram);
		expect(queuedProgram?.tranches[0]?.status).toBe("SHIPPED");
		expect(queuedProgram?.tranches[1]?.status).toBe("QUEUED");

		const retrospectiveState = {
			...activeState,
			currentPhase: "RETROSPECTIVE" as const,
			phases: activeState.phases.map((phase) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN", "BUILD", "SHIP"].includes(phase.name)
					? { ...phase, status: "DONE" as const }
					: { ...phase, status: "IN_PROGRESS" as const },
			),
			pendingDispatches: [
				makePendingDispatch({
					dispatchId: "dispatch_retro_program",
					phase: "RETROSPECTIVE",
					agent: "oc-shipper",
				}),
			],
		};
		await saveState(retrospectiveState, tempDir);

		const retroResult = JSON.parse(
			await orchestrateCore(
				{
					result: JSON.stringify({
						schemaVersion: 1,
						resultId: "retro-program-1",
						runId: retrospectiveState.runId,
						phase: "RETROSPECTIVE",
						dispatchId: "dispatch_retro_program",
						agent: "oc-shipper",
						kind: "phase_output",
						taskId: null,
						payload: { text: JSON.stringify({ lessons: [] }) },
					}),
				},
				tempDir,
			),
		);

		expect(retroResult.action).toBe("dispatch");
		expect(retroResult.phase).toBe("RECON");
		expect(retroResult.program.trancheIndex).toBe(2);

		const advancedProgram = loadLatestProgramRunFromKernel(tempDir);
		expect(advancedProgram?.tranches[0]?.status).toBe("COMPLETED");
		expect(advancedProgram?.tranches[1]?.status).toBe("IN_PROGRESS");
	});

	test("final tranche waits for program Oracle signoff before completing", async () => {
		const program = planProgramRunFromRequest(
			[
				"Implement the remediation program:",
				"1. Add program persistence.",
				"2. Continue automatically across multiple PRs.",
			].join("\n"),
			"normal",
			{ executionMode: "background" },
		);
		if (!program || program.tranches.length < 2) {
			throw new Error("Expected a multi-tranche program fixture");
		}

		const finalTranche = program.tranches[1];
		if (!finalTranche) {
			throw new Error("Expected a final tranche fixture");
		}

		saveProgramRunToKernel(tempDir, {
			...program,
			status: "ACTIVE",
			currentTrancheId: finalTranche.trancheId,
			tranches: program.tranches.map((tranche) =>
				tranche.trancheId === program.tranches[0]?.trancheId
					? {
							...tranche,
							status: "COMPLETED" as const,
							deliveryManifestId: "manifest_run_1",
						}
					: tranche.trancheId === finalTranche.trancheId
						? {
								...tranche,
								status: "SHIPPED" as const,
								deliveryManifestId: "manifest_run_2",
							}
						: tranche,
			),
		});

		const retrospectiveState = {
			...createInitialState(buildPipelineIdeaForTranche(program, finalTranche), {
				programContext: {
					programId: program.programId,
					trancheId: finalTranche.trancheId,
					trancheTitle: finalTranche.title,
					trancheIndex: finalTranche.sequence,
					trancheCount: program.tranches.length,
					selectionRationale: finalTranche.selectionRationale,
					originatingRequest: program.originatingRequest,
					mode: program.mode,
				},
			}),
			currentPhase: "RETROSPECTIVE" as const,
			phases: createInitialState("fixture").phases.map((phase) =>
				phase.name === "RETROSPECTIVE"
					? { ...phase, status: "IN_PROGRESS" as const }
					: { ...phase, status: "DONE" as const },
			),
			pendingDispatches: [
				makePendingDispatch({
					dispatchId: "dispatch_retro_final",
					phase: "RETROSPECTIVE",
					agent: "oc-shipper",
				}),
			],
		};
		await saveState(retrospectiveState, tempDir);

		const blocked = JSON.parse(
			await orchestrateCore(
				{
					result: JSON.stringify({
						schemaVersion: 1,
						resultId: "retro-final-program-1",
						runId: retrospectiveState.runId,
						phase: "RETROSPECTIVE",
						dispatchId: "dispatch_retro_final",
						agent: "oc-shipper",
						kind: "phase_output",
						taskId: null,
						payload: { text: JSON.stringify({ lessons: [] }) },
					}),
				},
				tempDir,
			),
		);

		expect(blocked.action).toBe("dispatch");
		expect(blocked.agent).toBe("oracle");
		expect(blocked.resultKind).toBe("oracle_signoff");

		const blockedProgram = loadLatestProgramRunFromKernel(tempDir);
		expect(blockedProgram?.status).toBe("BLOCKED");
		expect(blockedProgram?.blockedReason).toBe("Program Oracle signoff required");

		const blockedState = await loadState(tempDir);
		expect(blockedState?.status).not.toBe("COMPLETED");
		expect(blockedState?.oracleSignoffs.program?.verdict).toBe("PENDING");

		const oracleSignoff = blockedState?.oracleSignoffs.program;
		if (!oracleSignoff || !blockedState) {
			throw new Error("Expected pending program Oracle signoff state");
		}

		const completion = JSON.parse(
			await orchestrateCore(
				{
					result: JSON.stringify({
						schemaVersion: 1,
						resultId: "retro-final-program-2",
						runId: blockedState.runId,
						phase: "RETROSPECTIVE",
						dispatchId: blocked.dispatchId,
						agent: "oracle",
						kind: "oracle_signoff",
						taskId: null,
						payload: {
							text: formatOracleSignoffEnvelope({
								signoffId: oracleSignoff.signoffId,
								scope: "PROGRAM",
								inputsDigest: oracleSignoff.inputsDigest,
								verdict: "PASS",
								reasoning: "Oracle approved final program completion.",
							}),
						},
					}),
				},
				tempDir,
			),
		);

		expect(completion.action).toBe("complete");
		expect(completion.programStatus).toBe("COMPLETED");

		const completedProgram = loadLatestProgramRunFromKernel(tempDir);
		expect(completedProgram?.status).toBe("COMPLETED");
		expect(completedProgram?.finalOracleVerdict).toBe("Oracle approved final program completion.");
	});

	test("terminal autonomous program stops are classified explicitly as blocked", async () => {
		const broadIdea = [
			"Implement the remediation program:",
			"1. Add program and tranche persistence.",
			"2. Continue automatically across multiple PRs.",
		].join("\n");
		await orchestrateCore({ idea: broadIdea, intent: "implementation" }, tempDir);

		const activeState = await loadState(tempDir);
		if (!activeState?.programContext) {
			throw new Error("Expected initial run to create program context");
		}

		await saveState(
			{
				...activeState,
				currentPhase: "BUILD" as const,
				phases: activeState.phases.map((phase) =>
					phase.name === "BUILD"
						? { ...phase, status: "IN_PROGRESS" as const }
						: ["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(phase.name)
							? { ...phase, status: "DONE" as const }
							: { ...phase, status: "PENDING" as const },
				),
				pendingDispatches: [],
				tasks: [
					{
						id: 1,
						title: "Blocked task",
						status: "BLOCKED" as const,
						wave: 1,
						depends_on: [],
						attempt: 0,
						strike: 0,
					},
				],
			},
			tempDir,
		);

		const result = JSON.parse(await orchestrateCore({}, tempDir));

		expect(result.action).toBe("error");
		expect(result.stopClassification).toBe("BLOCKED");
		expect(result.programStatus).toBe("BLOCKED");

		const blockedProgram = loadLatestProgramRunFromKernel(tempDir);
		expect(blockedProgram?.status).toBe("BLOCKED");
		expect(blockedProgram?.tranches[0]?.status).toBe("BLOCKED");
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

	test("prompt forbids discretionary tranche questions", () => {
		expect(autopilotAgent.prompt).toContain("DO NOT ask the user which tranche to do first");
		expect(autopilotAgent.prompt).toContain("DO NOT ask discretionary questions");
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

	test("oc_route returns routeToken for implementation route and oc_orchestrate accepts it", async () => {
		const routeContext = {
			sessionID: "session-route-token-1",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-1",
		} as unknown as Parameters<typeof ocRoute.execute>[1];

		const route = JSON.parse(
			await ocRoute.execute(
				{
					primaryIntent: "implementation",
					reasoning: "User asked for a feature",
					verbalization: "I detect implementation intent",
				},
				routeContext,
			),
		);
		expect(route.action).toBe("route");
		expect(route.usePipeline).toBe(true);
		expect(route.requiredPipelineArgs).toBeDefined();
		expect(typeof route.requiredPipelineArgs.routeToken).toBe("string");

		const orchestrateContext = {
			sessionID: routeContext.sessionID,
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-1",
		} as unknown as Parameters<typeof ocOrchestrate.execute>[1];

		const started = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add onboarding wizard",
					intent: "implementation",
					routeToken: route.requiredPipelineArgs.routeToken,
				},
				orchestrateContext,
			),
		);
		expect(started.action).toBe("dispatch");
		expect(started.phase).toBe("RECON");
	});

	test("route ticket is single-use — second orchestrate call with same token is rejected", async () => {
		const routeContext = {
			sessionID: "session-route-token-single-use",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-single-use",
		} as unknown as Parameters<typeof ocRoute.execute>[1];

		const route = JSON.parse(
			await ocRoute.execute(
				{
					primaryIntent: "implementation",
					reasoning: "User asked for a feature",
					verbalization: "I detect implementation intent",
				},
				routeContext,
			),
		);

		const orchestrateContext = {
			sessionID: routeContext.sessionID,
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-single-use",
		} as unknown as Parameters<typeof ocOrchestrate.execute>[1];

		const first = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add implementation details",
					intent: "implementation",
					routeToken: route.requiredPipelineArgs.routeToken,
				},
				orchestrateContext,
			),
		);
		expect(first.action).not.toBe("error");

		await rm(join(tempDir, ".opencode-autopilot"), { recursive: true, force: true });

		const second = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add implementation details again",
					intent: "implementation",
					routeToken: route.requiredPipelineArgs.routeToken,
				},
				orchestrateContext,
			),
		);

		expect(second.action).toBe("error");
		expect(["E_ROUTE_TOKEN_CONSUMED", "E_ROUTE_TOKEN_INVALID", "E_INVALID_ROUTE_TOKEN"]).toContain(
			second.code,
		);
	});

	test("oc_orchestrate rejects missing routeToken and reports token error", async () => {
		const context = {
			sessionID: "session-route-token-missing",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-2",
		} as unknown as Parameters<typeof ocOrchestrate.execute>[1];

		const result = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add analytics panel",
					intent: "implementation",
				},
				context,
			),
		);

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_ROUTE_TOKEN_REQUIRED");
	});

	test("oc_orchestrate rejects routeToken from wrong session/project", async () => {
		const firstRouteContext = {
			sessionID: "session-route-token-wrong",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-3",
		} as unknown as Parameters<typeof ocRoute.execute>[1];

		const route = JSON.parse(
			await ocRoute.execute(
				{
					primaryIntent: "implementation",
					reasoning: "User asked for a feature",
					verbalization: "I detect implementation intent",
				},
				firstRouteContext,
			),
		);
		expect(route.action).toBe("route");

		const wrongContext = {
			sessionID: "session-route-token-wrong-bad",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-3",
		} as unknown as Parameters<typeof ocOrchestrate.execute>[1];

		const mismatch = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add user profile page",
					intent: "implementation",
					routeToken: route.requiredPipelineArgs.routeToken,
				},
				wrongContext,
			),
		);
		expect(mismatch.action).toBe("error");
		expect(mismatch.code).toBe("E_ROUTE_TOKEN_MISMATCH");
	});

	test("route ticket rejects session mismatch", async () => {
		const routeContext = {
			sessionID: "session-A",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-session-mismatch",
		} as unknown as Parameters<typeof ocRoute.execute>[1];

		const route = JSON.parse(
			await ocRoute.execute(
				{
					primaryIntent: "implementation",
					reasoning: "User asked for a feature",
					verbalization: "I detect implementation intent",
				},
				routeContext,
			),
		);

		const mismatchedContext = {
			sessionID: "session-B",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-session-mismatch",
		} as unknown as Parameters<typeof ocOrchestrate.execute>[1];

		const result = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add session-bound route ticket checks",
					intent: "implementation",
					routeToken: route.requiredPipelineArgs.routeToken,
				},
				mismatchedContext,
			),
		);

		expect(result.action).toBe("error");
		expect(result.code).toContain("MISMATCH");
		expect(result.message.toLowerCase()).toContain("session");
	});

	test("route ticket rejects project mismatch (different worktree/directory)", async () => {
		const routeContext = {
			sessionID: "session-project-mismatch",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-project-mismatch",
		} as unknown as Parameters<typeof ocRoute.execute>[1];

		const route = JSON.parse(
			await ocRoute.execute(
				{
					primaryIntent: "implementation",
					reasoning: "User asked for a feature",
					verbalization: "I detect implementation intent",
				},
				routeContext,
			),
		);

		// Create a SECOND temp dir to simulate a different project
		const otherDir = await mkdtemp(join(tmpdir(), "orchestrate-tool-test-other-"));

		try {
			const mismatchedContext = {
				sessionID: routeContext.sessionID, // Same session
				directory: otherDir,
				worktree: otherDir, // DIFFERENT project root
				messageID: "route-msg-project-mismatch",
			} as unknown as Parameters<typeof ocOrchestrate.execute>[1];

			const result = JSON.parse(
				await ocOrchestrate.execute(
					{
						idea: "add cross-project check",
						intent: "implementation",
						routeToken: route.requiredPipelineArgs.routeToken,
					},
					mismatchedContext,
				),
			);

			expect(result.action).toBe("error");
			// When using a different project dir, a different kernel DB is opened.
			// The ticket doesn't exist in that DB, so we get INVALID rather than MISMATCH.
			expect(result.code).toBe("E_INVALID_ROUTE_TOKEN");
			expect(result.message.toLowerCase()).toContain("route ticket not found");
		} finally {
			await rm(otherDir, { recursive: true, force: true });
		}
	});

	test("oc_orchestrate accepts routeToken when called without the original message context (messageId is not validated)", async () => {
		const routeContext = {
			sessionID: "session-route-token-msg",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-5",
		} as unknown as Parameters<typeof ocRoute.execute>[1];

		const route = JSON.parse(
			await ocRoute.execute(
				{
					primaryIntent: "implementation",
					reasoning: "User asked for a feature",
					verbalization: "I detect implementation intent",
				},
				routeContext,
			),
		);

		const contextWithoutMessage = {
			sessionID: routeContext.sessionID,
			directory: tempDir,
			worktree: tempDir,
		} as unknown as Parameters<typeof ocOrchestrate.execute>[1];

		const result = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add user settings",
					intent: "implementation",
					routeToken: route.requiredPipelineArgs.routeToken,
				},
				contextWithoutMessage,
			),
		);

		expect(result.action).not.toBe("error");
	});

	test("route ticket succeeds across different messageId", async () => {
		const routeContext = {
			sessionID: "session-route-token-different-message",
			directory: tempDir,
			worktree: tempDir,
			messageID: "msg-1",
		} as unknown as Parameters<typeof ocRoute.execute>[1];

		const route = JSON.parse(
			await ocRoute.execute(
				{
					primaryIntent: "implementation",
					reasoning: "User asked for a feature",
					verbalization: "I detect implementation intent",
				},
				routeContext,
			),
		);

		const contextWithoutMessage = {
			sessionID: routeContext.sessionID,
			directory: tempDir,
			worktree: tempDir,
		} as unknown as Parameters<typeof ocOrchestrate.execute>[1];

		const result = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add account preferences",
					intent: "implementation",
					routeToken: route.requiredPipelineArgs.routeToken,
				},
				contextWithoutMessage,
			),
		);

		expect(result.action).not.toBe("error");
	});

	test("routeToken cannot start a second run while another run is active", async () => {
		const routeContext = {
			sessionID: "session-route-token-consume",
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-4",
		} as unknown as Parameters<typeof ocRoute.execute>[1];

		const route = JSON.parse(
			await ocRoute.execute(
				{
					primaryIntent: "implementation",
					reasoning: "User asked for a feature",
					verbalization: "I detect implementation intent",
				},
				routeContext,
			),
		);

		const context = {
			sessionID: routeContext.sessionID,
			directory: tempDir,
			worktree: tempDir,
			messageID: "route-msg-4",
		} as unknown as Parameters<typeof ocOrchestrate.execute>[1];

		const first = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add dark mode",
					intent: "implementation",
					routeToken: route.requiredPipelineArgs.routeToken,
				},
				context,
			),
		);
		expect(first.action).toBe("dispatch");

		const repeat = JSON.parse(
			await ocOrchestrate.execute(
				{
					idea: "add dark mode again",
					intent: "implementation",
					routeToken: route.requiredPipelineArgs.routeToken,
				},
				context,
			),
		);
		expect(repeat.action).toBe("error");
		expect(repeat.code).toBe("E_ACTIVE_RUN_EXISTS");
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
		expect(parsed.action).toBe("error");
		expect(parsed.code).toBe("E_ACTIVE_RUN_EXISTS");
		expect(parsed.message).toContain("abandon: true");
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
		const reconDir = getPhaseDir(tempDir, "RECON", first.runId);
		await mkdir(reconDir, { recursive: true });
		await writeFile(join(reconDir, "report.md"), "# Report\ntest report");
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
		const reconDir = getPhaseDir(tempDir, "RECON", first.runId);
		await mkdir(reconDir, { recursive: true });
		await writeFile(join(reconDir, "report.md"), "# Report\ntest report");
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
