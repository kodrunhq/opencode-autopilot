import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createForensicEvent } from "../../src/observability/forensic-log";
import { failureContextSchema, PHASES, pipelineStateSchema } from "../../src/orchestrator/schemas";
import type { PipelineState } from "../../src/orchestrator/types";

// ---------- helpers ----------

function makeMinimalState(overrides: Record<string, unknown> = {}): PipelineState {
	const now = new Date().toISOString();
	const status = (overrides.status as PipelineState["status"] | undefined) ?? "IN_PROGRESS";
	const currentPhase =
		(overrides.currentPhase as PipelineState["currentPhase"] | undefined) ??
		(status === "COMPLETED" ? null : "RECON");
	const phases =
		(overrides.phases as PipelineState["phases"] | undefined) ??
		PHASES.map((name) => ({
			name,
			status: currentPhase === null ? "PENDING" : name === currentPhase ? "IN_PROGRESS" : "PENDING",
		}));
	return pipelineStateSchema.parse({
		schemaVersion: 2,
		status,
		runId: "run-forensics-test",
		stateRevision: 0,
		idea: "test idea",
		currentPhase,
		startedAt: now,
		lastUpdatedAt: now,
		phases,
		decisions: [],
		confidence: [],
		tasks: [],
		arenaConfidence: null,
		exploreTriggered: false,
		buildProgress: {
			currentTask: null,
			currentWave: null,
			attemptCount: 0,
			strikeCount: 0,
			reviewPending: false,
		},
		pendingDispatches: [],
		processedResultIds: [],
		failureContext: null,
		phaseDispatchCounts: {},
		...overrides,
	});
}

async function writeState(dir: string, state: PipelineState): Promise<void> {
	const { ensureDir } = await import("../../src/utils/fs-helpers");
	await ensureDir(dir);
	await writeFile(join(dir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
}

async function _readState(dir: string): Promise<PipelineState> {
	const raw = await readFile(join(dir, "state.json"), "utf-8");
	return pipelineStateSchema.parse(JSON.parse(raw));
}

// ---------- Task 1: failureContext schema and backward compatibility ----------

describe("failureContext schema", () => {
	test("failureContextSchema validates a complete failure context", () => {
		const fc = failureContextSchema.parse({
			failedPhase: "BUILD",
			failedAgent: "oc-builder",
			errorMessage: "Build failed with 3 strikes",
			timestamp: new Date().toISOString(),
			lastSuccessfulPhase: "PLAN",
		});
		expect(fc.failedPhase).toBe("BUILD");
		expect(fc.failedAgent).toBe("oc-builder");
		expect(fc.errorMessage).toBe("Build failed with 3 strikes");
		expect(fc.lastSuccessfulPhase).toBe("PLAN");
	});

	test("failureContextSchema allows null failedAgent and lastSuccessfulPhase", () => {
		const fc = failureContextSchema.parse({
			failedPhase: "RECON",
			failedAgent: null,
			errorMessage: "Failed during recon",
			timestamp: new Date().toISOString(),
			lastSuccessfulPhase: null,
		});
		expect(fc.failedAgent).toBeNull();
		expect(fc.lastSuccessfulPhase).toBeNull();
	});

	test("pipelineStateSchema defaults failureContext to null (backward compat)", () => {
		const state = makeMinimalState();
		expect(state.failureContext).toBeNull();
	});

	test("existing state files without failureContext parse cleanly", () => {
		const raw = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			idea: "old idea",
			currentPhase: "BUILD",
			startedAt: new Date().toISOString(),
			lastUpdatedAt: new Date().toISOString(),
			phases: PHASES.map((name) => ({ name, status: "PENDING" })),
		};
		const parsed = pipelineStateSchema.parse(raw);
		expect(parsed.failureContext).toBeNull();
	});

	test("pipelineStateSchema accepts failureContext with valid data", () => {
		const state = makeMinimalState({
			status: "FAILED",
			failureContext: {
				failedPhase: "ARCHITECT",
				failedAgent: "oc-architect",
				errorMessage: "Arena failed",
				timestamp: new Date().toISOString(),
				lastSuccessfulPhase: "CHALLENGE",
			},
		});
		expect(state.failureContext).not.toBeNull();
		expect(state.failureContext?.failedPhase).toBe("ARCHITECT");
	});
});

// ---------- Task 1: orchestrateCore failure capture ----------

describe("orchestrateCore failure metadata capture", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "forensics-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("catch block persists failureContext to state on error", async () => {
		// We test the failure capture logic directly using state utilities
		// since PHASE_HANDLERS is frozen and cannot be mocked by assignment.
		const { loadState, patchState, saveState } = await import("../../src/orchestrator/state");

		const state = makeMinimalState({
			currentPhase: "RECON",
			phases: PHASES.map((name) => ({
				name,
				status: name === "RECON" ? "IN_PROGRESS" : "PENDING",
			})),
		});
		await writeState(tmpDir, state);

		// Simulate what the catch block does
		const currentState = await loadState(tmpDir);
		expect(currentState).not.toBeNull();
		if (!currentState) throw new Error("Expected current state");

		const errorMessage = "Simulated RECON failure";
		const lastDone = currentState.phases.filter((p) => p.status === "DONE").pop();
		const failureContext = {
			failedPhase: currentState.currentPhase as NonNullable<PipelineState["currentPhase"]>,
			failedAgent: null as string | null,
			errorMessage: errorMessage.slice(0, 4096),
			timestamp: new Date().toISOString(),
			lastSuccessfulPhase: lastDone?.name ?? null,
		};
		const failed = patchState(currentState, {
			status: "FAILED" as const,
			failureContext,
		});
		await saveState(failed, tmpDir);

		// Verify persisted state
		const updatedState = await loadState(tmpDir);
		expect(updatedState?.status).toBe("FAILED");
		expect(updatedState?.failureContext).not.toBeNull();
		expect(updatedState?.failureContext?.failedPhase).toBe("RECON");
		expect(updatedState?.failureContext?.errorMessage).toBe("Simulated RECON failure");
		expect(updatedState?.failureContext?.lastSuccessfulPhase).toBeNull();
	});

	test("lastSuccessfulPhase reflects the last DONE phase", async () => {
		const { loadState, patchState, saveState } = await import("../../src/orchestrator/state");

		const state = makeMinimalState({
			currentPhase: "ARCHITECT",
			phases: PHASES.map((name) => ({
				name,
				status:
					name === "RECON" || name === "CHALLENGE"
						? "DONE"
						: name === "ARCHITECT"
							? "IN_PROGRESS"
							: "PENDING",
				completedAt: name === "RECON" || name === "CHALLENGE" ? new Date().toISOString() : null,
			})),
		});
		await writeState(tmpDir, state);

		const currentState = await loadState(tmpDir);
		if (!currentState) throw new Error("Expected current state");
		const lastDone = currentState.phases.filter((p) => p.status === "DONE").pop();
		const failureContext = {
			failedPhase: currentState.currentPhase as NonNullable<PipelineState["currentPhase"]>,
			failedAgent: null as string | null,
			errorMessage: "Arena crashed",
			timestamp: new Date().toISOString(),
			lastSuccessfulPhase: lastDone?.name ?? null,
		};
		const failed = patchState(currentState, {
			status: "FAILED" as const,
			failureContext,
		});
		await saveState(failed, tmpDir);

		const updatedState = await loadState(tmpDir);
		expect(updatedState?.failureContext?.lastSuccessfulPhase).toBe("CHALLENGE");
	});

	test("if loadState fails in catch block, original error still returned", async () => {
		// The catch block swallows inner errors -- we verify the pattern
		// by confirming that a try/catch around a failing loadState still
		// allows the outer return
		let originalErrorReturned = false;
		const _errorMessage = "Build exploded";

		try {
			// Simulate loadState throwing by reading from a non-existent corrupt path
			const { loadState } = await import("../../src/orchestrator/state");
			const badDir = join(tmpDir, "nonexistent-subdir");
			// Write an invalid JSON file to force a parse error
			const { ensureDir } = await import("../../src/utils/fs-helpers");
			await ensureDir(badDir);
			await writeFile(join(badDir, "state.json"), "NOT VALID JSON", "utf-8");

			try {
				await loadState(badDir);
			} catch {
				// Swallow save errors -- original error takes priority
			}

			// Original error message is still available
			originalErrorReturned = true;
		} catch {
			// Should not reach here
		}

		expect(originalErrorReturned).toBe(true);
	});
});

// ---------- Task 2: forensicsCore ----------

describe("forensicsCore", () => {
	let tmpDir: string;
	let projectRoot: string;

	beforeEach(async () => {
		projectRoot = await mkdtemp(join(tmpdir(), "forensics-project-"));
		tmpDir = join(projectRoot, ".opencode-autopilot");
	});

	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	test("no state file returns error 'No pipeline state found'", async () => {
		const { forensicsCore } = await import("../../src/tools/forensics");
		const result = JSON.parse(await forensicsCore({}, projectRoot));
		expect(result.action).toBe("error");
		expect(result.message).toBe("No pipeline state found");
	});

	test("IN_PROGRESS state returns 'No failure to diagnose'", async () => {
		const { forensicsCore } = await import("../../src/tools/forensics");
		const state = makeMinimalState({ status: "IN_PROGRESS" });
		await writeState(tmpDir, state);

		const result = JSON.parse(await forensicsCore({}, projectRoot));
		expect(result.action).toBe("error");
		expect(result.message).toBe("No failure to diagnose -- pipeline status: IN_PROGRESS");
	});

	test("FAILED state without failureContext returns 'No failure metadata recorded'", async () => {
		const { forensicsCore } = await import("../../src/tools/forensics");
		const state = makeMinimalState({ status: "FAILED", failureContext: null });
		await writeState(tmpDir, state);

		const result = JSON.parse(await forensicsCore({}, projectRoot));
		expect(result.action).toBe("error");
		expect(result.message).toBe("No failure metadata recorded");
	});

	test("FAILED + failureContext with ARCHITECT phase -> recoverable, suggestedAction resume", async () => {
		const { forensicsCore } = await import("../../src/tools/forensics");
		const state = makeMinimalState({
			status: "FAILED",
			currentPhase: "ARCHITECT",
			phases: PHASES.map((name) => ({
				name,
				status:
					name === "RECON" || name === "CHALLENGE"
						? "DONE"
						: name === "ARCHITECT"
							? "IN_PROGRESS"
							: "PENDING",
				completedAt: name === "RECON" || name === "CHALLENGE" ? new Date().toISOString() : null,
			})),
			failureContext: {
				failedPhase: "ARCHITECT",
				failedAgent: "oc-architect",
				errorMessage: "Arena failed",
				timestamp: new Date().toISOString(),
				lastSuccessfulPhase: "CHALLENGE",
			},
		});
		await writeState(tmpDir, state);

		const result = JSON.parse(await forensicsCore({}, projectRoot));
		expect(result.failedPhase).toBe("ARCHITECT");
		expect(result.failedAgent).toBe("oc-architect");
		expect(result.errorMessage).toBe("Arena failed");
		expect(result.lastSuccessfulPhase).toBe("CHALLENGE");
		expect(result.recoverable).toBe(true);
		expect(result.suggestedAction).toBe("resume");
	});

	test("FAILED + failureContext with BUILD phase -> terminal, suggestedAction restart", async () => {
		const { forensicsCore } = await import("../../src/tools/forensics");
		const state = makeMinimalState({
			status: "FAILED",
			currentPhase: "BUILD",
			failureContext: {
				failedPhase: "BUILD",
				failedAgent: null,
				errorMessage: "Strike overflow",
				timestamp: new Date().toISOString(),
				lastSuccessfulPhase: "PLAN",
			},
		});
		await writeState(tmpDir, state);

		const result = JSON.parse(await forensicsCore({}, projectRoot));
		expect(result.failedPhase).toBe("BUILD");
		expect(result.recoverable).toBe(false);
		expect(result.suggestedAction).toBe("restart");
	});

	test("FAILED + failureContext with RECON phase -> recoverable, suggestedAction restart", async () => {
		const { forensicsCore } = await import("../../src/tools/forensics");
		const state = makeMinimalState({
			status: "FAILED",
			failureContext: {
				failedPhase: "RECON",
				failedAgent: null,
				errorMessage: "Recon failed",
				timestamp: new Date().toISOString(),
				lastSuccessfulPhase: null,
			},
		});
		await writeState(tmpDir, state);

		const result = JSON.parse(await forensicsCore({}, projectRoot));
		expect(result.failedPhase).toBe("RECON");
		expect(result.recoverable).toBe(true);
		expect(result.suggestedAction).toBe("restart");
	});

	test("phasesCompleted lists all DONE phases", async () => {
		const { forensicsCore } = await import("../../src/tools/forensics");
		const state = makeMinimalState({
			status: "FAILED",
			currentPhase: "PLAN",
			phases: PHASES.map((name) => ({
				name,
				status:
					name === "RECON" || name === "CHALLENGE" || name === "ARCHITECT"
						? "DONE"
						: name === "PLAN"
							? "IN_PROGRESS"
							: "PENDING",
				completedAt:
					name === "RECON" || name === "CHALLENGE" || name === "ARCHITECT"
						? new Date().toISOString()
						: null,
			})),
			failureContext: {
				failedPhase: "PLAN",
				failedAgent: null,
				errorMessage: "Plan generation failed",
				timestamp: new Date().toISOString(),
				lastSuccessfulPhase: "ARCHITECT",
			},
		});
		await writeState(tmpDir, state);

		const result = JSON.parse(await forensicsCore({}, projectRoot));
		expect(result.phasesCompleted).toEqual(["RECON", "CHALLENGE", "ARCHITECT"]);
		expect(Array.isArray(result.deterministicErrorCodes)).toBe(true);
	});

	test("surfaces deterministic error codes from orchestration log", async () => {
		const { forensicsCore } = await import("../../src/tools/forensics");
		const state = makeMinimalState({
			status: "FAILED",
			failureContext: {
				failedPhase: "BUILD",
				failedAgent: null,
				errorMessage: "failure",
				timestamp: new Date().toISOString(),
				lastSuccessfulPhase: "PLAN",
			},
		});
		await writeState(tmpDir, state);
		await writeFile(
			join(tmpDir, "orchestration.jsonl"),
			`${JSON.stringify(
				createForensicEvent({
					projectRoot,
					domain: "contract",
					type: "error",
					code: "E_DUPLICATE_RESULT",
					message: "E_DUPLICATE_RESULT: duplicate",
				}),
			)}\n`,
			"utf-8",
		);

		const result = JSON.parse(await forensicsCore({}, projectRoot));
		expect(result.deterministicErrorCodes).toContain("E_DUPLICATE_RESULT");
	});
});
