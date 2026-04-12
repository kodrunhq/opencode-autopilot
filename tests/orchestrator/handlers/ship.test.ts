import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	initBranchLifecycle,
	recordPrCreation,
} from "../../../src/orchestrator/handlers/branch-pr";
import { createShipHandler } from "../../../src/orchestrator/handlers/ship";
import { createInitialState } from "../../../src/orchestrator/state";
import type { PipelineState } from "../../../src/orchestrator/types";

let artifactDir: string;

beforeEach(async () => {
	artifactDir = await mkdtemp(join(tmpdir(), "ship-handler-test-"));
});

afterEach(async () => {
	await rm(artifactDir, { recursive: true, force: true });
});

function createShipState(options?: { readonly withPr?: boolean }): PipelineState {
	const baseState = createInitialState(
		"delivery manifest, commit strategy, and CI verification gates",
	);
	const initialBranchLifecycle = {
		...initBranchLifecycle({
			runId: baseState.runId,
			baseBranch: "main",
			description: baseState.idea,
		}),
		tasksPushed: ["1", "2"],
		reviewSummary: "APPROVED — review completed with no tranche blockers.",
		oracleSummary: "PASS — Oracle signoff completed.",
	};
	const branchLifecycle = options?.withPr
		? recordPrCreation(initialBranchLifecycle, 23, "https://github.com/example/repo/pull/23")
		: initialBranchLifecycle;

	return {
		...baseState,
		currentPhase: "SHIP",
		oracleSignoffs: {
			tranche: {
				signoffId: "tranche_signoff_test",
				scope: "TRANCHE",
				inputsDigest: "digest-1234",
				verdict: "PASS",
				reasoning: "Oracle approved the tranche.",
				blockingConditions: [],
			},
			program: null,
		},
		tasks: [
			{
				id: 1,
				title: "Add delivery manifest generation",
				status: "DONE",
				wave: 1,
				depends_on: [],
				attempt: 0,
				strike: 0,
			},
			{
				id: 2,
				title: "Block ship on failed CI checks",
				status: "DONE",
				wave: 1,
				depends_on: [1],
				attempt: 0,
				strike: 0,
			},
		],
		branchLifecycle,
	};
}

async function writeShipArtifacts(state: PipelineState): Promise<void> {
	const shipDir = join(artifactDir, "phases", state.runId, "SHIP");
	await mkdir(shipDir, { recursive: true });
	await Promise.all([
		writeFile(join(shipDir, "walkthrough.md"), "# Walkthrough\nDone", "utf-8"),
		writeFile(join(shipDir, "changelog.md"), "# Changelog\nDone", "utf-8"),
		writeFile(join(shipDir, "decisions.md"), "# Decisions\nDone", "utf-8"),
	]);
}

describe("createShipHandler", () => {
	test("dispatches shipper with manifest-rendered PR instructions", async () => {
		const state = createShipState();
		const handleShip = createShipHandler();

		const result = await handleShip(state, artifactDir);
		const prompt = result.prompt ?? "";

		expect(result.action).toBe("dispatch");
		expect(prompt).toContain("## PR Creation Instructions");
		expect(prompt).toContain("## Scope");
		expect(prompt).toContain("## Review Summary");
		expect(prompt).toContain("## Oracle Verdict");
		expect(prompt).toContain("## Verification Summary");
		expect(prompt).toContain("Commit policy");
	});

	test("initializes branch lifecycle with program identity when program context is present", async () => {
		const state = {
			...createShipState(),
			branchLifecycle: null,
			programContext: {
				programId: "program_ship_identity",
				trancheId: "tranche_ship_identity",
				trancheTitle: "Ship identity tranche",
				trancheIndex: 1,
				trancheCount: 2,
				selectionRationale: "Selected for ship identity propagation.",
				originatingRequest: "Ship the program.",
				mode: "autonomous" as const,
			},
		} satisfies PipelineState;
		const handleShip = createShipHandler();

		const result = await handleShip(state, artifactDir);

		expect(result._stateUpdates?.branchLifecycle?.programId).toBe("program_ship_identity");
		expect(result._stateUpdates?.branchLifecycle?.trancheId).toBe("tranche_ship_identity");
	});

	test("blocks completion when local verification fails", async () => {
		const state = createShipState({ withPr: true });
		await writeShipArtifacts(state);
		const handleShip = createShipHandler({
			runLocalVerification: async () => ({
				passed: false,
				status: "FAILED",
				checks: [{ name: "tests", passed: false, status: "FAILED", message: "tests failed" }],
				timestamp: new Date().toISOString(),
			}),
			pollGitHubChecks: async () => ({
				status: "PASSED",
				summary: "All required GitHub checks passed (2 total).",
				checks: [],
				attempts: 1,
			}),
		});

		const result = await handleShip(state, artifactDir, "ship completed");

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_SHIP_VERIFICATION_FAILED");
		expect(result.message).toContain("Delivery blocked");
		expect(result._stateUpdates?.verificationStatus?.status).toBe("FAILED");
		expect(result._stateUpdates?.verificationStatus?.localStatus).toBe("FAILED");
		expect(result._stateUpdates?.verificationStatus?.ciStatus).toBe("PASSED");
	});

	test("waits when required CI checks remain pending", async () => {
		const state = createShipState({ withPr: true });
		await writeShipArtifacts(state);
		const handleShip = createShipHandler({
			runLocalVerification: async () => ({
				passed: true,
				status: "PASSED",
				checks: [{ name: "tests", passed: true, status: "PASSED", message: "tests passed" }],
				timestamp: new Date().toISOString(),
			}),
			pollGitHubChecks: async () => ({
				status: "PENDING",
				summary: "Required GitHub checks are still pending: ci.",
				checks: [],
				attempts: 1,
			}),
		});

		const result = await handleShip(state, artifactDir, "ship completed");

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_SHIP_CI_PENDING");
		expect(result.message).toContain("waiting");
		expect(result._stateUpdates?.verificationStatus?.status).toBe("PENDING");
		expect(result._stateUpdates?.verificationStatus?.localStatus).toBe("PASSED");
		expect(result._stateUpdates?.verificationStatus?.ciStatus).toBe("PENDING");
	});

	test("completes only after local verification and CI checks pass", async () => {
		const state = createShipState({ withPr: true });
		await writeShipArtifacts(state);
		const handleShip = createShipHandler({
			runLocalVerification: async () => ({
				passed: true,
				status: "PASSED",
				checks: [
					{ name: "tests", passed: true, status: "PASSED", message: "tests passed" },
					{ name: "lint", passed: true, status: "PASSED", message: "lint passed" },
				],
				timestamp: new Date().toISOString(),
			}),
			pollGitHubChecks: async () => ({
				status: "PASSED",
				summary: "All required GitHub checks passed (2 total).",
				checks: [],
				attempts: 1,
			}),
		});

		const result = await handleShip(state, artifactDir, "ship completed");

		expect(result.action).toBe("complete");
		expect(result.progress).toContain("CI gates passed");
		expect(result._stateUpdates?.branchLifecycle?.verificationSummary).toContain("passed");
		expect(result._stateUpdates?.verificationStatus).toEqual({
			status: "PASSED",
			summary: "Required local verification and GitHub CI checks passed.",
			localStatus: "PASSED",
			localSummary: "Verification PASSED: 2 PASSED.",
			ciStatus: "PASSED",
			ciSummary: "All required GitHub checks passed (2 total).",
			updatedAt: result._stateUpdates?.verificationStatus?.updatedAt,
		});
		expect(typeof result._stateUpdates?.verificationStatus?.updatedAt).toBe("string");
	});
});
