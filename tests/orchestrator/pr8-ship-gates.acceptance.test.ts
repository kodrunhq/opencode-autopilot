import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createDeliveryManifest,
	renderDeliveryPrBody,
	renderDeliveryPrTitle,
} from "../../src/orchestrator/delivery-manifest";
import type { GitHubChecksPollResult } from "../../src/orchestrator/github-checks";
import { initBranchLifecycle, recordPrCreation } from "../../src/orchestrator/handlers/branch-pr";
import { createShipHandler } from "../../src/orchestrator/handlers/ship";
import { reviewStatusSchema } from "../../src/orchestrator/review-runner";
import { createInitialState } from "../../src/orchestrator/state";
import type { PipelineState } from "../../src/orchestrator/types";

function createPassingReviewStatus() {
	const timestamp = new Date().toISOString();
	return reviewStatusSchema.parse({
		reviewRunId: "review_pr8_ship",
		trancheId: "tranche_pr8_ship",
		scope: "branch",
		status: "PASSED",
		verdict: "APPROVED",
		blockingSeverityThreshold: "HIGH",
		selectedReviewers: ["logic-auditor"],
		requiredReviewers: ["logic-auditor"],
		missingRequiredReviewers: [],
		reviewers: [
			{
				reviewer: "logic-auditor",
				required: true,
				status: "COMPLETED",
				findingsCount: 0,
				startedAt: timestamp,
				completedAt: timestamp,
			},
		],
		findingsSummary: {
			CRITICAL: 0,
			HIGH: 0,
			MEDIUM: 0,
			LOW: 0,
			open: 0,
			accepted: 0,
			fixed: 0,
			blockingOpen: 0,
		},
		summary: "Structured review passed.",
		blockedReason: null,
		startedAt: timestamp,
		completedAt: timestamp,
	});
}

function createPassingTrancheSignoff() {
	return {
		signoffId: "tranche_signoff_pr8_ship",
		scope: "TRANCHE" as const,
		inputsDigest: "digest-pr8-ship",
		verdict: "PASS" as const,
		reasoning: "Oracle approved the tranche.",
		blockingConditions: [],
	};
}

function createCiResult(
	status: GitHubChecksPollResult["status"],
	summary: string,
): GitHubChecksPollResult {
	return {
		status,
		summary,
		checks: [],
		attempts: 1,
	};
}

function createShipState(options?: { readonly withPr?: boolean }): PipelineState {
	const baseState = createInitialState(
		"RAW IDEA TEXT SHOULD NEVER BECOME BRANCH METADATA OR PR COPY.",
	);
	const branchLifecycle = recordPrCreation(
		{
			...initBranchLifecycle({
				runId: baseState.runId,
				baseBranch: "main",
				description: baseState.idea,
				humanTitle: "Acceptance harness tranche",
				programId: "program_pr8_acceptance",
				trancheId: "tranche_acceptance",
			}),
			tasksPushed: ["1", "2"],
			reviewSummary: "APPROVED — review completed with no blockers.",
			oracleSummary: "PASS — Oracle approved shipment.",
		},
		31,
		"https://github.com/example/repo/pull/31",
	);

	return {
		...baseState,
		currentPhase: "SHIP",
		tasks: [
			{
				id: 1,
				title: "Generate delivery manifest",
				status: "DONE",
				wave: 1,
				depends_on: [],
				attempt: 0,
				strike: 0,
			},
			{
				id: 2,
				title: "Gate ship on CI",
				status: "DONE",
				wave: 1,
				depends_on: [1],
				attempt: 0,
				strike: 0,
			},
		],
		reviewStatus: createPassingReviewStatus(),
		oracleSignoffs: {
			tranche: createPassingTrancheSignoff(),
			program: null,
		},
		branchLifecycle:
			options?.withPr === false
				? { ...branchLifecycle, prNumber: null, prUrl: null }
				: branchLifecycle,
	};
}

async function writeShipArtifacts(artifactDir: string, runId: string): Promise<void> {
	const shipDir = join(artifactDir, "phases", runId, "SHIP");
	await mkdir(shipDir, { recursive: true });
	await Promise.all([
		writeFile(join(shipDir, "walkthrough.md"), "# Walkthrough\n\nDone", "utf-8"),
		writeFile(join(shipDir, "changelog.md"), "# Changelog\n\nDone", "utf-8"),
		writeFile(join(shipDir, "decisions.md"), "# Decisions\n\nDone", "utf-8"),
	]);
}

describe("PR-8 acceptance — ship gates and manifest metadata", () => {
	let artifactDir = "";

	beforeEach(async () => {
		artifactDir = await mkdtemp(join(tmpdir(), "pr8-ship-gates-"));
	});

	afterEach(async () => {
		await rm(artifactDir, { recursive: true, force: true });
	});

	test("matrix 5: SHIP fails closed on missing tranche Oracle signoff before verification or CI checks run", async () => {
		let localVerificationCalls = 0;
		let ciPollingCalls = 0;
		const state = {
			...createShipState(),
			oracleSignoffs: { tranche: null, program: null },
		};

		const result = await createShipHandler({
			runLocalVerification: async () => {
				localVerificationCalls += 1;
				return {
					passed: true,
					status: "PASSED" as const,
					checks: [],
					timestamp: new Date().toISOString(),
				};
			},
			pollGitHubChecks: async () => {
				ciPollingCalls += 1;
				return createCiResult("PASSED", "All required GitHub checks passed.");
			},
		})(state, artifactDir, "ship completed");

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_ORACLE_TRANCHE_SIGNOFF_REQUIRED");
		expect(localVerificationCalls).toBe(0);
		expect(ciPollingCalls).toBe(0);
	});

	test("matrix 6: verification and CI gates prevent SHIP completion until every required check passes", async () => {
		const scenarios = [
			{
				name: "failed local verification",
				localVerification: {
					passed: false,
					status: "FAILED" as const,
					checks: [
						{ name: "tests", passed: false, status: "FAILED" as const, message: "tests failed" },
					],
					timestamp: new Date().toISOString(),
				},
				ciResult: {
					...createCiResult("PASSED", "All required GitHub checks passed (2 total)."),
				},
				expectedCode: "E_SHIP_VERIFICATION_FAILED",
				expectedStatus: "FAILED",
			},
			{
				name: "blocked local verification evidence",
				localVerification: {
					passed: false,
					status: "BLOCKED" as const,
					checks: [
						{
							name: "docker",
							passed: false,
							status: "BLOCKED" as const,
							message: "docker unavailable",
						},
					],
					timestamp: new Date().toISOString(),
				},
				ciResult: {
					...createCiResult("PASSED", "All required GitHub checks passed (2 total)."),
				},
				expectedCode: "E_SHIP_VERIFICATION_BLOCKED",
				expectedStatus: "BLOCKED",
			},
			{
				name: "pending GitHub checks",
				localVerification: {
					passed: true,
					status: "PASSED" as const,
					checks: [
						{ name: "tests", passed: true, status: "PASSED" as const, message: "tests passed" },
					],
					timestamp: new Date().toISOString(),
				},
				ciResult: {
					...createCiResult("PENDING", "Required GitHub checks are still pending: ci."),
				},
				expectedCode: "E_SHIP_CI_PENDING",
				expectedStatus: "PENDING",
			},
		] as const;

		for (const scenario of scenarios) {
			const state = createShipState();
			await writeShipArtifacts(artifactDir, state.runId);

			const result = await createShipHandler({
				runLocalVerification: async () => scenario.localVerification,
				pollGitHubChecks: async () => scenario.ciResult,
			})(state, artifactDir, `ship completed: ${scenario.name}`);

			expect(result.action).toBe("error");
			expect(result.code).toBe(scenario.expectedCode);
			expect(result._stateUpdates?.verificationStatus?.status).toBe(scenario.expectedStatus);
		}
	});

	test("matrix 10: branch and PR metadata comes from the delivery manifest, not raw idea text", () => {
		const state = createShipState({ withPr: false });
		const manifest = createDeliveryManifest({ state });
		const title = renderDeliveryPrTitle(manifest);
		const body = renderDeliveryPrBody(manifest);

		expect(manifest.humanTitle).toBe("Acceptance harness tranche");
		expect(manifest.programId).toBe("program_pr8_acceptance");
		expect(manifest.trancheId).toBe("tranche_acceptance");
		expect(manifest.branchName).toBe(state.branchLifecycle?.currentBranch);
		expect(manifest.branchName).toContain("acceptance-harness-tranche");
		expect(manifest.branchName).not.toContain("raw-idea");
		expect(title).toBe("Acceptance harness tranche");
		expect(body).toContain("`program_pr8_acceptance`");
		expect(body).toContain("`tranche_acceptance`");
		expect(body).toContain(`\`${manifest.branchName}\``);
		expect(title).not.toContain("RAW IDEA TEXT SHOULD NEVER");
		expect(body).not.toContain("RAW IDEA TEXT SHOULD NEVER");
	});
});
