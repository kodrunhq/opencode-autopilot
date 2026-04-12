import { describe, expect, test } from "bun:test";
import {
	buildReviewGateMessage,
	completeReviewRun,
	planReviewRun,
	reviewRunSchema,
	summarizeReviewRun,
} from "../../src/orchestrator/review-runner";
import { reviewReportSchema } from "../../src/review/schemas";

describe("review-runner", () => {
	test("planReviewRun makes required reviewers visible in status", async () => {
		const plan = await planReviewRun(process.cwd(), {
			scope: "branch",
			runId: "run_review_plan",
			reviewRunId: "review_plan_1",
			selectedReviewers: ["logic-auditor", "security-auditor"],
			requiredReviewers: ["logic-auditor", "security-auditor", "red-team"],
			blockingSeverityThreshold: "HIGH",
		});

		const status = summarizeReviewRun(plan.reviewRun);
		expect(status.reviewRunId).toBe("review_plan_1");
		expect(status.requiredReviewers).toEqual(["logic-auditor", "security-auditor", "red-team"]);
		expect(status.reviewers.map((reviewer) => reviewer.reviewer)).toContain("product-thinker");
	});

	test("completeReviewRun blocks when required reviewer did not execute", () => {
		const reviewRun = reviewRunSchema.parse({
			reviewRunId: "review_blocked_missing",
			runId: "run_blocked_missing",
			trancheId: "tranche_blocked_missing",
			scope: "branch",
			status: "RUNNING",
			verdict: "PENDING",
			policy: {
				requiredReviewers: ["logic-auditor", "security-auditor"],
				blockingSeverityThreshold: "HIGH",
				allowedWaivers: [],
			},
			selectedReviewers: ["logic-auditor", "security-auditor"],
			reviewers: [
				{ reviewer: "logic-auditor", required: true, status: "RUNNING", findingsCount: 0 },
				{ reviewer: "security-auditor", required: true, status: "PENDING", findingsCount: 0 },
			],
			findings: [],
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
			startedAt: "2026-04-12T00:00:00.000Z",
		});
		const report = reviewReportSchema.parse({
			verdict: "CLEAN",
			findings: [],
			agentResults: [],
			scope: "branch",
			agentsRan: ["logic-auditor"],
			selectedReviewers: ["logic-auditor", "security-auditor"],
			requiredReviewers: ["logic-auditor", "security-auditor"],
			executedReviewers: ["logic-auditor"],
			missingRequiredReviewers: ["security-auditor"],
			blockingSeverityThreshold: "HIGH",
			totalDurationMs: 0,
			completedAt: "2026-04-12T00:05:00.000Z",
			summary: "missing required reviewer",
		});

		const completedRun = completeReviewRun(reviewRun, report, ["logic-auditor"]);
		const status = summarizeReviewRun(completedRun);

		expect(completedRun.status).toBe("BLOCKED");
		expect(status.missingRequiredReviewers).toEqual(["security-auditor"]);
		expect(buildReviewGateMessage(status)).toContain("security-auditor");
	});

	test("completeReviewRun blocks on open findings at policy threshold", () => {
		const reviewRun = reviewRunSchema.parse({
			reviewRunId: "review_blocked_findings",
			runId: "run_blocked_findings",
			trancheId: "tranche_blocked_findings",
			scope: "branch",
			status: "RUNNING",
			verdict: "PENDING",
			policy: {
				requiredReviewers: ["logic-auditor"],
				blockingSeverityThreshold: "HIGH",
				allowedWaivers: [],
			},
			selectedReviewers: ["logic-auditor"],
			reviewers: [
				{ reviewer: "logic-auditor", required: true, status: "RUNNING", findingsCount: 0 },
			],
			findings: [],
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
			startedAt: "2026-04-12T00:00:00.000Z",
		});
		const report = reviewReportSchema.parse({
			verdict: "CONCERNS",
			findings: [
				{
					severity: "HIGH",
					domain: "logic",
					title: "Edge case failure",
					file: "src/example.ts",
					line: 10,
					agent: "logic-auditor",
					source: "phase1",
					evidence: "missing null guard",
					problem: "throws on empty input",
					fix: "return early for empty input",
				},
			],
			agentResults: [],
			scope: "branch",
			agentsRan: ["logic-auditor"],
			selectedReviewers: ["logic-auditor"],
			requiredReviewers: ["logic-auditor"],
			executedReviewers: ["logic-auditor"],
			missingRequiredReviewers: [],
			blockingSeverityThreshold: "HIGH",
			totalDurationMs: 0,
			completedAt: "2026-04-12T00:05:00.000Z",
			summary: "1 HIGH finding",
		});

		const completedRun = completeReviewRun(reviewRun, report, ["logic-auditor"]);
		const status = summarizeReviewRun(completedRun);

		expect(completedRun.findingsSummary.blockingOpen).toBe(1);
		expect(status.status).toBe("BLOCKED");
		expect(buildReviewGateMessage(status)).toContain("remain at or above HIGH");
	});
});
