import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLatestReviewRunFromKernel } from "../../src/kernel/repository";
import { initBranchLifecycle } from "../../src/orchestrator/handlers/branch-pr";
import { createShipHandler } from "../../src/orchestrator/handlers/ship";
import { reviewStatusSchema } from "../../src/orchestrator/review-runner";
import { createInitialState } from "../../src/orchestrator/state";
import { reviewCore } from "../../src/tools/review";
import { getProjectArtifactDir } from "../../src/utils/paths";

function buildStageResultsEnvelope(
	reviewer: string,
	findings: readonly Record<string, unknown>[],
): string {
	return JSON.stringify({
		schemaVersion: 1,
		kind: "review_stage_results",
		results: [{ reviewer, status: "completed", findings }],
	});
}

describe("PR-8 acceptance — review gating", () => {
	let projectRoot = "";

	beforeEach(async () => {
		projectRoot = await mkdtemp(join(tmpdir(), "pr8-review-"));
		await writeFile(
			join(projectRoot, "package.json"),
			JSON.stringify({ name: "pr8-review" }),
			"utf-8",
		);
	});

	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	test("matrix 4: executed reviewers persist structurally and blocking findings stop SHIP", async () => {
		const start = JSON.parse(
			await reviewCore(
				{
					scope: "all",
					reviewRunId: "review_pr8_acceptance",
					selectedReviewers: ["logic-auditor"],
					requiredReviewers: ["logic-auditor"],
					blockingSeverityThreshold: "HIGH",
				},
				projectRoot,
			),
		) as { action: string };
		expect(start.action).toBe("dispatch");

		await reviewCore(
			{
				findings: buildStageResultsEnvelope("logic-auditor", [
					{
						severity: "HIGH",
						domain: "logic",
						title: "Blocking acceptance gap",
						file: "src/orchestrator/handlers/ship.ts",
						line: 42,
						agent: "logic-auditor",
						source: "phase1",
						evidence: "SHIP would proceed despite an unresolved blocker.",
						problem: "Delivery is not safe while the blocker remains open.",
						fix: "Fail closed before shipping.",
					},
				]),
			},
			projectRoot,
		);
		await reviewCore({ findings: buildStageResultsEnvelope("logic-auditor", []) }, projectRoot);

		const completed = JSON.parse(
			await reviewCore(
				{
					findings: JSON.stringify({
						schemaVersion: 1,
						kind: "review_stage_results",
						results: [
							{ reviewer: "logic-auditor", status: "completed", findings: [] },
							{ reviewer: "product-thinker", status: "completed", findings: [] },
						],
					}),
				},
				projectRoot,
			),
		) as { action: string; reviewStatus: unknown };

		expect(completed.action).toBe("complete");

		const reviewStatus = reviewStatusSchema.parse(completed.reviewStatus);
		expect(reviewStatus.status).toBe("BLOCKED");
		expect(reviewStatus.findingsSummary.blockingOpen).toBe(1);
		expect(
			reviewStatus.reviewers.some(
				(reviewer) => reviewer.reviewer === "logic-auditor" && reviewer.status === "COMPLETED",
			),
		).toBe(true);

		const artifactDir = getProjectArtifactDir(projectRoot);
		const persistedRun = loadLatestReviewRunFromKernel(artifactDir);
		expect(persistedRun?.status).toBe("BLOCKED");
		expect(persistedRun?.findingsSummary.blockingOpen).toBe(1);
		expect(persistedRun?.findings[0]?.title).toBe("Blocking acceptance gap");

		const shipStateBase = createInitialState("Ship the acceptance harness");
		const shipState = {
			...shipStateBase,
			currentPhase: "SHIP" as const,
			branchLifecycle: {
				...initBranchLifecycle({
					runId: shipStateBase.runId,
					baseBranch: "main",
					description: "Ship the acceptance harness",
				}),
				tasksPushed: ["1"],
			},
			reviewStatus,
			oracleSignoffs: {
				tranche: {
					signoffId: "tranche_signoff_pr8_review",
					scope: "TRANCHE" as const,
					inputsDigest: "digest-pr8-review",
					verdict: "PASS" as const,
					reasoning: "Oracle approved the tranche.",
					blockingConditions: [],
				},
				program: null,
			},
		};

		const shipResult = await createShipHandler()(shipState, artifactDir);
		expect(shipResult.action).toBe("error");
		expect(shipResult.code).toBe("E_SHIP_REVIEW_BLOCKED");
		expect(shipResult.message).toContain("remain at or above HIGH");
	});
});
