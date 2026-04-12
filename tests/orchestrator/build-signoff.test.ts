import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleBuild } from "../../src/orchestrator/handlers/build";
import type { PhaseHandlerContext } from "../../src/orchestrator/handlers/types";
import {
	formatOracleSignoffEnvelope,
	getTrancheOracleSignoffArtifactPath,
} from "../../src/orchestrator/signoff";
import { createInitialState } from "../../src/orchestrator/state";
import type { PipelineState } from "../../src/orchestrator/types";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "build-signoff-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

function createBuildState(): PipelineState {
	const base = createInitialState("Implement structured Oracle signoff");
	return {
		...base,
		currentPhase: "BUILD",
		tasks: [
			{
				id: 1,
				title: "Implement structured Oracle signoff",
				status: "DONE",
				wave: 1,
				depends_on: [],
				attempt: 0,
				strike: 0,
			},
		],
		buildProgress: {
			...base.buildProgress,
			currentWave: 1,
			lastReviewReport: "No CRITICAL findings. Review passed.",
		},
		phases: base.phases.map((phase) =>
			["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(phase.name)
				? { ...phase, status: "DONE" as const }
				: phase.name === "BUILD"
					? { ...phase, status: "IN_PROGRESS" as const }
					: phase,
		),
	};
}

function createOracleContext(
	state: PipelineState,
	response: string,
	dispatchId = "dispatch-oracle-1",
): PhaseHandlerContext {
	return {
		envelope: {
			schemaVersion: 1,
			resultId: `result-${dispatchId}`,
			runId: state.runId,
			phase: "BUILD",
			dispatchId,
			agent: "oracle",
			kind: "oracle_signoff",
			taskId: null,
			payload: { text: response },
		},
	};
}

describe("BUILD Oracle tranche signoff", () => {
	test("dispatches mandatory tranche Oracle signoff before SHIP", async () => {
		const state = createBuildState();

		const result = await handleBuild(state, tempDir);

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oracle");
		expect(result.resultKind).toBe("oracle_signoff");
		expect(result._stateUpdates?.buildProgress?.oraclePending).toBe(true);
	});

	test("initializes branch lifecycle with program identity when program context is present", async () => {
		const state = {
			...createBuildState(),
			programContext: {
				programId: "program_build_identity",
				trancheId: "tranche_build_identity",
				trancheTitle: "Build identity tranche",
				trancheIndex: 1,
				trancheCount: 2,
				selectionRationale: "Selected for build identity propagation.",
				originatingRequest: "Ship the program.",
				mode: "autonomous" as const,
			},
			branchLifecycle: null,
		} satisfies PipelineState;

		const result = await handleBuild(state, tempDir);

		expect(result._stateUpdates?.branchLifecycle?.programId).toBe("program_build_identity");
		expect(result._stateUpdates?.branchLifecycle?.trancheId).toBe("tranche_build_identity");
	});

	test("persists passing tranche signoff and completes BUILD", async () => {
		const initialState = createBuildState();
		const dispatch = await handleBuild(initialState, tempDir);
		const pendingBuildProgress = dispatch._stateUpdates?.buildProgress;
		expect(dispatch.action).toBe("dispatch");
		expect(pendingBuildProgress?.oracleSignoffId).toBeDefined();
		expect(pendingBuildProgress?.oracleInputsDigest).toBeDefined();

		const pendingState: PipelineState = {
			...initialState,
			buildProgress: {
				...initialState.buildProgress,
				...pendingBuildProgress,
			},
			branchLifecycle: dispatch._stateUpdates?.branchLifecycle ?? initialState.branchLifecycle,
		};
		const response = formatOracleSignoffEnvelope({
			signoffId: pendingState.buildProgress.oracleSignoffId ?? "missing",
			scope: "TRANCHE",
			inputsDigest: pendingState.buildProgress.oracleInputsDigest ?? "missing",
			verdict: "PASS",
			reasoning: "Ready to ship.",
			blockingConditions: [],
		});

		const completion = await handleBuild(
			pendingState,
			tempDir,
			response,
			createOracleContext(pendingState, response),
		);

		expect(completion.action).toBe("complete");
		expect(completion._stateUpdates?.oracleSignoffs?.tranche?.verdict).toBe("PASS");

		const artifactPath = getTrancheOracleSignoffArtifactPath(tempDir, pendingState.runId);
		const persisted = JSON.parse(await readFile(artifactPath, "utf-8")) as { verdict: string };
		expect(persisted.verdict).toBe("PASS");
	});

	test("persists failing tranche signoff blockers and stops BUILD completion", async () => {
		const initialState = createBuildState();
		const dispatch = await handleBuild(initialState, tempDir);
		const pendingState: PipelineState = {
			...initialState,
			buildProgress: {
				...initialState.buildProgress,
				...dispatch._stateUpdates?.buildProgress,
			},
			branchLifecycle: dispatch._stateUpdates?.branchLifecycle ?? initialState.branchLifecycle,
		};
		const response = formatOracleSignoffEnvelope({
			signoffId: pendingState.buildProgress.oracleSignoffId ?? "missing",
			scope: "TRANCHE",
			inputsDigest: pendingState.buildProgress.oracleInputsDigest ?? "missing",
			verdict: "FAIL",
			reasoning: "Not ready to ship.",
			blockingConditions: ["Fix the remaining regression coverage gap."],
		});

		const blocked = await handleBuild(
			pendingState,
			tempDir,
			response,
			createOracleContext(pendingState, response, "dispatch-oracle-2"),
		);

		expect(blocked.action).toBe("error");
		expect(blocked.code).toBe("E_ORACLE_TRANCHE_SIGNOFF_FAILED");
		expect(blocked.message).toContain("Fix the remaining regression coverage gap.");
		expect(blocked._stateUpdates?.oracleSignoffs?.tranche?.verdict).toBe("FAIL");

		const artifactPath = getTrancheOracleSignoffArtifactPath(tempDir, pendingState.runId);
		const persisted = JSON.parse(await readFile(artifactPath, "utf-8")) as {
			blockingConditions: string[];
		};
		expect(persisted.blockingConditions).toEqual(["Fix the remaining regression coverage gap."]);
	});
});
