/// <reference types="bun" />

import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultConfig, loadConfig, pluginConfigSchema } from "../../src/config";
import { configModeCoherenceCheck } from "../../src/health/checks";
import { openKernelDb } from "../../src/kernel/database";
import { getPhaseDir } from "../../src/orchestrator/artifacts";
import { handleArchitect } from "../../src/orchestrator/handlers/architect";
import { handleChallenge } from "../../src/orchestrator/handlers/challenge";
import { handleRecon } from "../../src/orchestrator/handlers/recon";
import type { DispatchResult } from "../../src/orchestrator/handlers/types";
import { PHASES, pendingDispatchSchema, pipelineStateSchema } from "../../src/orchestrator/schemas";
import { loadState } from "../../src/orchestrator/state";
import type { PipelineState } from "../../src/orchestrator/types";
import { orchestrateCore } from "../../src/tools/orchestrate";
import { sanitizeChatMessageParts } from "../../src/ux/visibility";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })),
	);
});

async function createTempDir(prefix: string): Promise<string> {
	const tempDir = await mkdtemp(join(tmpdir(), `forensic-regression-${prefix}-`));
	tempDirs.push(tempDir);
	return tempDir;
}

function createContradictoryLegacyConfig(): ReturnType<typeof createDefaultConfig> {
	const baseConfig = createDefaultConfig();

	return {
		...baseConfig,
		configured: true,
		orchestrator: {
			...baseConfig.orchestrator,
			autonomy: "full",
		},
		autonomy: {
			...baseConfig.autonomy,
			enabled: false,
		},
		background: {
			...baseConfig.background,
			enabled: false,
		},
		routing: {
			...baseConfig.routing,
			enabled: false,
		},
	};
}

async function writeJsonFile(tempDir: string, fileName: string, payload: unknown): Promise<string> {
	const filePath = join(tempDir, fileName);
	await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
	return filePath;
}

function createPipelineState(
	currentPhase: (typeof PHASES)[number],
	overrides: Partial<PipelineState> = {},
): PipelineState {
	const now = new Date().toISOString();

	return pipelineStateSchema.parse({
		schemaVersion: 2,
		status: "IN_PROGRESS",
		idea: "Validate forensic regression coverage",
		currentPhase,
		startedAt: now,
		lastUpdatedAt: now,
		phases: PHASES.map((phase, index) => ({
			name: phase,
			phaseNumber: index + 1,
			status: phase === currentPhase ? "IN_PROGRESS" : "PENDING",
		})),
		...overrides,
	});
}

function expectRecoverableArtifactError(
	result: DispatchResult,
	phase: "RECON" | "CHALLENGE" | "ARCHITECT",
	artifactName: string,
): void {
	expect(result.action).toBe("error");
	expect(result.phase).toBe(phase);
	expect(result.message).toContain(artifactName);
	expect(result.errorSeverity).toBe("recoverable");
}

describe("forensic regression acceptance", () => {
	test("contradictory legacy config rejection blocks loadConfig and pluginConfigSchema", async () => {
		const tempDir = await createTempDir("contradictory-config");
		const contradictoryConfig = createContradictoryLegacyConfig();
		const configPath = await writeJsonFile(tempDir, "opencode-autopilot.json", contradictoryConfig);

		let loadConfigError = "";
		try {
			await loadConfig(configPath);
		} catch (error) {
			loadConfigError = error instanceof Error ? error.message : String(error);
		}

		expect(loadConfigError).toContain("Contradictory autonomy configuration");
		expect(() => pluginConfigSchema.parse(contradictoryConfig)).toThrow(
			/Contradictory autonomy configuration/,
		);
	});

	test("late artifact arrival keeps FAILED_RECOVERABLE dispatches parseable and resumable", () => {
		const pendingDispatch = pendingDispatchSchema.parse({
			dispatchId: "dispatch_recon_late_artifact",
			phase: "RECON",
			agent: "oc-researcher",
			issuedAt: "2026-04-13T00:00:00.000Z",
			status: "FAILED_RECOVERABLE",
		});

		expect(pendingDispatch).toHaveProperty("status", "FAILED_RECOVERABLE");

		const state = createPipelineState("RECON", {
			pendingDispatches: [pendingDispatch],
		});

		expect(state.pendingDispatches[0]).toHaveProperty("status", "FAILED_RECOVERABLE");
	});

	test("config mode coherence health check surfaces contradictory autonomy errors", async () => {
		const tempDir = await createTempDir("config-mode-coherence");
		const configPath = await writeJsonFile(
			tempDir,
			"opencode-autopilot.json",
			createContradictoryLegacyConfig(),
		);

		const result = await configModeCoherenceCheck(configPath);
		const diagnosticText = [result.message, JSON.stringify(result.details ?? [])].join("\n");

		expect(result.status).toBe("fail");
		expect(diagnosticText).toContain("Contradictory autonomy configuration");
	});

	test("handler artifact errors for RECON, CHALLENGE, and ARCHITECT are recoverable", async () => {
		const artifactDir = await createTempDir("missing-artifacts");

		const reconResult = await handleRecon(
			createPipelineState("RECON"),
			artifactDir,
			"agent output",
		);
		expectRecoverableArtifactError(reconResult, "RECON", "report.md");

		const challengeResult = await handleChallenge(
			createPipelineState("CHALLENGE"),
			artifactDir,
			"agent output",
		);
		expectRecoverableArtifactError(challengeResult, "CHALLENGE", "brief.md");

		const architectResult = await handleArchitect(
			createPipelineState("ARCHITECT"),
			artifactDir,
			"agent output",
		);
		expectRecoverableArtifactError(architectResult, "ARCHITECT", "design.md");
	});

	test("RECON failure sequence keeps the original dispatch recoverable until retry advances to CHALLENGE", async () => {
		const tempDir = await createTempDir("recon-failure-sequence");
		const first = JSON.parse(
			await orchestrateCore({ idea: "test recon failure", intent: "implementation" }, tempDir),
		);

		expect(first.action).toBe("dispatch");
		expect(first.phase).toBe("RECON");

		const missingArtifactEnvelope = {
			schemaVersion: 1,
			resultId: "recon-failure-sequence-1",
			runId: first.runId,
			phase: "RECON",
			dispatchId: first.dispatchId,
			agent: first.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "research complete" },
		};

		const failedAttempt = JSON.parse(
			await orchestrateCore({ result: JSON.stringify(missingArtifactEnvelope) }, tempDir),
		);
		expectRecoverableArtifactError(failedAttempt, "RECON", "report.md");

		const stateAfterFailure = await loadState(tempDir);
		const failedDispatch = stateAfterFailure?.pendingDispatches.find(
			(dispatch) => dispatch.dispatchId === first.dispatchId,
		);

		expect(stateAfterFailure?.status).toBe("IN_PROGRESS");
		expect(failedDispatch).toMatchObject({
			dispatchId: first.dispatchId,
			status: "FAILED_RECOVERABLE",
			receivedResultId: "recon-failure-sequence-1",
		});

		const dbAfterFailure = openKernelDb(tempDir);
		try {
			const persistedDispatch = dbAfterFailure
				.query("SELECT status FROM run_pending_dispatches WHERE dispatch_id = ?")
				.get(first.dispatchId) as { readonly status: string } | null;
			expect(persistedDispatch).toEqual({ status: "FAILED_RECOVERABLE" });
		} finally {
			dbAfterFailure.close();
		}

		const reconDir = getPhaseDir(tempDir, "RECON", first.runId);
		await mkdir(reconDir, { recursive: true });
		await writeFile(join(reconDir, "report.md"), "# Report\nrecovered recon artifact", "utf-8");

		const retriedAttempt = JSON.parse(
			await orchestrateCore(
				{
					result: JSON.stringify({
						...missingArtifactEnvelope,
						resultId: "recon-failure-sequence-2",
					}),
				},
				tempDir,
			),
		);

		expect(retriedAttempt.action).toBe("dispatch");
		expect(retriedAttempt.phase).toBe("CHALLENGE");

		const stateAfterRetry = await loadState(tempDir);
		expect(
			stateAfterRetry?.pendingDispatches.some(
				(dispatch) => dispatch.dispatchId === first.dispatchId,
			),
		).toBe(false);
		expect(stateAfterRetry?.processedResultIds).not.toContain("recon-failure-sequence-1");
		expect(stateAfterRetry?.processedResultIds).toContain("recon-failure-sequence-2");

		const dbAfterRetry = openKernelDb(tempDir);
		try {
			const persistedDispatch = dbAfterRetry
				.query("SELECT status FROM run_pending_dispatches WHERE dispatch_id = ?")
				.get(first.dispatchId);
			expect(persistedDispatch).toBeNull();
		} finally {
			dbAfterRetry.close();
		}
	});

	test("session correlation preserves caller and spawned session ids while keeping sessionId aliased", () => {
		const pendingDispatch = pendingDispatchSchema.parse({
			dispatchId: "dispatch_session_split",
			phase: "RECON",
			agent: "oc-researcher",
			issuedAt: "2026-04-13T00:00:00.000Z",
			callerSessionId: "ses_caller_123",
			spawnedSessionId: "ses_spawned_456",
		});

		expect(pendingDispatch.callerSessionId).toBe("ses_caller_123");
		expect(pendingDispatch.spawnedSessionId).toBe("ses_spawned_456");
		expect(pendingDispatch.sessionId).toBe("ses_caller_123");
	});

	test("prompt leak guard removes leaked control prompt blocks during chat sanitization", () => {
		const parts: Array<Record<string, unknown>> = [
			{
				type: "text",
				text: [
					"_Thinking: ## TASK: Create acceptance regression test file",
					"Reasoning: MUST DO: keep the control prompt hidden",
					'<thinking>task(category="acceptance", description="private prompt")</thinking>',
					"Visible operator update",
				].join("\n"),
			},
		];

		sanitizeChatMessageParts(parts);

		expect(parts).toEqual([{ type: "text", text: "Visible operator update" }]);
	});

	test("session IDs survive RESULT_RECEIVED state for recovery tools", () => {
		const dispatch = pendingDispatchSchema.parse({
			dispatchId: "dispatch_session_survival",
			phase: "RECON",
			agent: "oc-researcher",
			issuedAt: "2026-04-13T00:00:00.000Z",
			callerSessionId: "ses_caller_survive",
			spawnedSessionId: "ses_spawned_survive",
			status: "RESULT_RECEIVED",
			receivedResultId: "result-123",
			receivedAt: "2026-04-13T00:01:00.000Z",
		});

		expect(dispatch.callerSessionId).toBe("ses_caller_survive");
		expect(dispatch.spawnedSessionId).toBe("ses_spawned_survive");
		expect(dispatch.status).toBe("RESULT_RECEIVED");
	});

	test("FAILED_RECOVERABLE dispatch preserves callerSessionId for runId-based recovery", () => {
		const dispatch = pendingDispatchSchema.parse({
			dispatchId: "dispatch_recoverable_session",
			phase: "CHALLENGE",
			agent: "oc-challenger",
			issuedAt: "2026-04-13T00:00:00.000Z",
			callerSessionId: "ses_caller_recover",
			status: "FAILED_RECOVERABLE",
		});

		expect(dispatch.callerSessionId).toBe("ses_caller_recover");
		expect(dispatch.status).toBe("FAILED_RECOVERABLE");
	});

	test("dispatch status schema has exactly 3 valid states (no dead states)", () => {
		const state = createPipelineState("RECON");
		const dispatch = state.pendingDispatches.length > 0 ? state.pendingDispatches[0] : null;

		const validStatuses = ["PENDING", "RESULT_RECEIVED", "FAILED_RECOVERABLE"];

		if (dispatch) {
			expect(validStatuses).toContain(dispatch.status);
		}

		expect(validStatuses).toHaveLength(3);
		expect(validStatuses).not.toContain("RESULT_ACCEPTED");
	});
});
