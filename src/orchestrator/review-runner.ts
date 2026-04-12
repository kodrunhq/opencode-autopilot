import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { REVIEW_AGENTS, SPECIALIZED_AGENTS, STAGE3_AGENTS } from "../review/agents/index";
import { collectDiffEvidence, type ReviewScope } from "../review/diff-evidence";
import { sanitizeTemplateContent } from "../review/sanitize";
import {
	reviewFindingsEnvelopeSchema,
	reviewReportSchema,
	severitySchema,
} from "../review/schemas";
import { selectAgents } from "../review/selection";
import { compareSeverity, isBlockingSeverity } from "../review/severity";
import { detectStackTags } from "../review/stack-gate";
import type { ReviewFinding, ReviewReport, Severity, Verdict } from "../review/types";

const execFileAsync = promisify(execFile);

export const REVIEW_FINDING_STATUSES = Object.freeze(["open", "accepted", "fixed"] as const);
export const REVIEW_REVIEWER_STATUSES = Object.freeze([
	"PENDING",
	"RUNNING",
	"COMPLETED",
	"FAILED",
	"SKIPPED",
] as const);
export const REVIEW_RUN_STATUSES = Object.freeze([
	"IDLE",
	"PLANNED",
	"RUNNING",
	"PASSED",
	"BLOCKED",
	"FAILED",
] as const);
export const REVIEW_RUN_VERDICTS = Object.freeze([
	"PENDING",
	"CLEAN",
	"APPROVED",
	"CONCERNS",
	"BLOCKED",
] as const);

const DEFAULT_BLOCKING_SEVERITY: Severity = "HIGH";

export const reviewFindingStatusSchema = z.enum(REVIEW_FINDING_STATUSES);
export const reviewReviewerStatusSchema = z.enum(REVIEW_REVIEWER_STATUSES);
export const reviewRunStatusSchema = z.enum(REVIEW_RUN_STATUSES);
export const reviewRunVerdictSchema = z.enum(REVIEW_RUN_VERDICTS);

export const reviewWaiverSchema = z.object({
	reviewer: z.string().max(128).nullable().default(null),
	severity: severitySchema.nullable().default(null),
	file: z.string().max(512).nullable().default(null),
	title: z.string().max(512).nullable().default(null),
	reason: z.string().max(1024).nullable().default(null),
});

export const reviewPolicySchema = z.object({
	requiredReviewers: z.array(z.string().max(128)).max(64).default([]),
	blockingSeverityThreshold: severitySchema.default(DEFAULT_BLOCKING_SEVERITY),
	allowedWaivers: z.array(reviewWaiverSchema).max(64).default([]),
});

export const reviewReviewerSchema = z.object({
	reviewer: z.string().max(128),
	required: z.boolean().default(false),
	status: reviewReviewerStatusSchema.default("PENDING"),
	findingsCount: z.number().int().min(0).default(0),
	startedAt: z.string().max(128).nullable().default(null),
	completedAt: z.string().max(128).nullable().default(null),
});

export const reviewRunFindingSchema = z.object({
	findingId: z.string().max(128),
	reviewRunId: z.string().max(128),
	reviewer: z.string().max(128),
	severity: severitySchema,
	file: z.string().max(512),
	line: z.number().int().positive().nullable().default(null),
	title: z.string().max(512),
	detail: z.string().max(4096),
	status: reviewFindingStatusSchema,
});

export const reviewFindingSummarySchema = z.object({
	CRITICAL: z.number().int().min(0).default(0),
	HIGH: z.number().int().min(0).default(0),
	MEDIUM: z.number().int().min(0).default(0),
	LOW: z.number().int().min(0).default(0),
	open: z.number().int().min(0).default(0),
	accepted: z.number().int().min(0).default(0),
	fixed: z.number().int().min(0).default(0),
	blockingOpen: z.number().int().min(0).default(0),
});

export const reviewStatusSchema = z.object({
	reviewRunId: z.string().max(128).nullable().default(null),
	trancheId: z.string().max(128).nullable().default(null),
	scope: z.string().max(4096).nullable().default(null),
	status: reviewRunStatusSchema.default("IDLE"),
	verdict: reviewRunVerdictSchema.nullable().default(null),
	blockingSeverityThreshold: severitySchema.default(DEFAULT_BLOCKING_SEVERITY),
	selectedReviewers: z.array(z.string().max(128)).max(64).default([]),
	requiredReviewers: z.array(z.string().max(128)).max(64).default([]),
	missingRequiredReviewers: z.array(z.string().max(128)).max(64).default([]),
	reviewers: z.array(reviewReviewerSchema).max(64).default([]),
	findingsSummary: reviewFindingSummarySchema.default({
		CRITICAL: 0,
		HIGH: 0,
		MEDIUM: 0,
		LOW: 0,
		open: 0,
		accepted: 0,
		fixed: 0,
		blockingOpen: 0,
	}),
	summary: z.string().max(4096).nullable().default(null),
	blockedReason: z.string().max(4096).nullable().default(null),
	startedAt: z.string().max(128).nullable().default(null),
	completedAt: z.string().max(128).nullable().default(null),
});

export const reviewRunSchema = z.object({
	reviewRunId: z.string().max(128),
	runId: z.string().max(128).nullable().default(null),
	trancheId: z.string().max(128).nullable().default(null),
	scope: z.string().max(4096),
	status: reviewRunStatusSchema.default("PLANNED"),
	verdict: reviewRunVerdictSchema.default("PENDING"),
	policy: reviewPolicySchema,
	selectedReviewers: z.array(z.string().max(128)).max(64).default([]),
	reviewers: z.array(reviewReviewerSchema).max(64).default([]),
	findings: z.array(reviewRunFindingSchema).max(500).default([]),
	findingsSummary: reviewFindingSummarySchema.default({
		CRITICAL: 0,
		HIGH: 0,
		MEDIUM: 0,
		LOW: 0,
		open: 0,
		accepted: 0,
		fixed: 0,
		blockingOpen: 0,
	}),
	summary: z.string().max(4096).nullable().default(null),
	blockedReason: z.string().max(4096).nullable().default(null),
	startedAt: z.string().max(128),
	completedAt: z.string().max(128).nullable().default(null),
});

export const reviewStageAgentResultSchema = z.object({
	reviewer: z.string().max(128),
	status: z.enum(["completed", "failed"]).default("completed"),
	completedAt: z.string().max(128).nullable().default(null),
	findings: z.array(z.unknown()).max(500).default([]),
});

export const reviewStageResultsEnvelopeSchema = z.object({
	schemaVersion: z.literal(1).default(1),
	kind: z.literal("review_stage_results"),
	results: z.array(reviewStageAgentResultSchema).max(64).default([]),
});

export const reviewCoordinatorResultSchema = z.object({
	action: z.enum(["dispatch", "complete", "status", "error"]),
	stage: z.number().int().positive().optional(),
	message: z.string().optional(),
	report: reviewReportSchema.optional(),
	findingsEnvelope: reviewFindingsEnvelopeSchema.optional(),
	reviewRun: reviewRunSchema.optional(),
	reviewStatus: reviewStatusSchema.optional(),
	reviewRunId: z.string().max(128).optional(),
	selectedReviewers: z.array(z.string().max(128)).max(64).optional(),
	requiredReviewers: z.array(z.string().max(128)).max(64).optional(),
	executedReviewers: z.array(z.string().max(128)).max(64).optional(),
	missingRequiredReviewers: z.array(z.string().max(128)).max(64).optional(),
	agents: z
		.array(
			z.object({
				name: z.string().max(128),
				prompt: z.string(),
			}),
		)
		.optional(),
});

export type ReviewPolicy = z.infer<typeof reviewPolicySchema>;
export type ReviewReviewer = z.infer<typeof reviewReviewerSchema>;
export type ReviewRunFinding = z.infer<typeof reviewRunFindingSchema>;
export type ReviewFindingSummary = z.infer<typeof reviewFindingSummarySchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type ReviewRun = z.infer<typeof reviewRunSchema>;
export type ReviewStageResultsEnvelope = z.infer<typeof reviewStageResultsEnvelopeSchema>;
export type ReviewCoordinatorResult = z.infer<typeof reviewCoordinatorResultSchema>;

export interface PlanReviewRunOptions {
	readonly scope: ReviewScope;
	readonly directory?: string;
	readonly runId?: string | null;
	readonly trancheId?: string | null;
	readonly reviewRunId?: string;
	readonly selectedReviewers?: readonly string[];
	readonly requiredReviewers?: readonly string[];
	readonly blockingSeverityThreshold?: Severity;
	readonly startedAt?: string;
}

export interface ReviewRunPlan {
	readonly reviewState: {
		readonly stage: 1;
		readonly selectedAgentNames: readonly string[];
		readonly requiredAgentNames: readonly string[];
		readonly executedAgentNames: readonly string[];
		readonly reviewRunId: string;
		readonly blockingSeverityThreshold: Severity;
		readonly runId: string | null;
		readonly trancheId: string | null;
		readonly accumulatedFindings: readonly ReviewFinding[];
		readonly scope: string;
		readonly diffEvidence?: string;
		readonly startedAt: string;
	};
	readonly reviewRun: ReviewRun;
	readonly agents: readonly { readonly name: string; readonly prompt: string }[];
	readonly selectedStageOneReviewers: readonly string[];
}

function generateReviewRunId(): string {
	return `review_${randomBytes(8).toString("hex")}`;
}

function generateFindingId(reviewRunId: string, index: number): string {
	return `${reviewRunId}_finding_${index + 1}`;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
	return Object.freeze([...new Set(values)]);
}

function createEmptyFindingSummary(): ReviewFindingSummary {
	return reviewFindingSummarySchema.parse({});
}

export function createIdleReviewStatus(): ReviewStatus {
	return reviewStatusSchema.parse({});
}

export async function getChangedFilesForReview(
	scope: ReviewScope,
	projectRoot: string,
	directory?: string,
): Promise<readonly string[]> {
	try {
		let args: string[];
		switch (scope) {
			case "staged":
				args = ["diff", "--cached", "--name-only"];
				break;
			case "unstaged":
				args = ["diff", "--name-only"];
				break;
			case "branch":
			case "all":
				args = ["diff", "--name-only", "HEAD"];
				break;
			case "directory":
				args = directory ? ["diff", "--name-only", "--", directory] : ["diff", "--name-only"];
				break;
			default:
				args = ["diff", "--name-only", "HEAD"];
				break;
		}
		const { stdout } = await execFileAsync("git", args, { cwd: projectRoot, timeout: 10_000 });
		return Object.freeze(stdout.trim().split("\n").filter(Boolean));
	} catch {
		return Object.freeze([]);
	}
}

function buildReviewPolicy(input: {
	readonly selectedStageOneReviewers: readonly string[];
	readonly requiredReviewers?: readonly string[];
	readonly blockingSeverityThreshold?: Severity;
}): ReviewPolicy {
	const requiredReviewers =
		input.requiredReviewers && input.requiredReviewers.length > 0
			? input.requiredReviewers
			: [...input.selectedStageOneReviewers, ...STAGE3_AGENTS.map((agent) => agent.name)];

	return reviewPolicySchema.parse({
		requiredReviewers: uniqueStrings(requiredReviewers),
		blockingSeverityThreshold: input.blockingSeverityThreshold ?? DEFAULT_BLOCKING_SEVERITY,
		allowedWaivers: [],
	});
}

function buildReviewerStates(
	stageOneReviewers: readonly string[],
	policy: Readonly<ReviewPolicy>,
	startedAt: string,
): readonly ReviewReviewer[] {
	const participants = uniqueStrings([
		...stageOneReviewers,
		...STAGE3_AGENTS.map((agent) => agent.name),
	]);
	const requiredSet = new Set(policy.requiredReviewers);
	return Object.freeze(
		participants.map((reviewer) =>
			reviewReviewerSchema.parse({
				reviewer,
				required: requiredSet.has(reviewer),
				status: reviewer === stageOneReviewers[0] ? "RUNNING" : "PENDING",
				findingsCount: 0,
				startedAt,
				completedAt: null,
			}),
		),
	);
}

function buildFindingSummary(
	findings: readonly ReviewRunFinding[],
	blockingSeverityThreshold: Severity,
): ReviewFindingSummary {
	const summary = createEmptyFindingSummary();
	for (const finding of findings) {
		summary[finding.severity] += 1;
		summary[finding.status] += 1;
		if (
			finding.status === "open" &&
			compareSeverity(finding.severity, blockingSeverityThreshold) <= 0
		) {
			summary.blockingOpen += 1;
		}
	}
	return reviewFindingSummarySchema.parse(summary);
}

function formatReviewRunSummary(input: {
	readonly verdict: ReviewRun["verdict"];
	readonly missingRequiredReviewers: readonly string[];
	readonly findingsSummary: Readonly<ReviewFindingSummary>;
	readonly blockingSeverityThreshold: Severity;
}): string {
	const parts: string[] = [];
	const severityParts = [
		input.findingsSummary.CRITICAL > 0 ? `${input.findingsSummary.CRITICAL} CRITICAL` : null,
		input.findingsSummary.HIGH > 0 ? `${input.findingsSummary.HIGH} HIGH` : null,
		input.findingsSummary.MEDIUM > 0 ? `${input.findingsSummary.MEDIUM} MEDIUM` : null,
		input.findingsSummary.LOW > 0 ? `${input.findingsSummary.LOW} LOW` : null,
	].filter((value): value is string => value !== null);

	if (severityParts.length > 0) {
		parts.push(`Findings: ${severityParts.join(", ")}.`);
	} else {
		parts.push("No findings.");
	}

	if (input.findingsSummary.blockingOpen > 0) {
		parts.push(
			`${input.findingsSummary.blockingOpen} open finding(s) at or above ${input.blockingSeverityThreshold}.`,
		);
	}

	if (input.missingRequiredReviewers.length > 0) {
		parts.push(`Missing required reviewers: ${input.missingRequiredReviewers.join(", ")}.`);
	}

	parts.push(`Verdict: ${input.verdict}.`);
	return parts.join(" ");
}

function matchesWaiver(finding: Readonly<ReviewFinding>, policy: Readonly<ReviewPolicy>): boolean {
	return policy.allowedWaivers.some((waiver) => {
		if (waiver.reviewer !== null && waiver.reviewer !== finding.agent) return false;
		if (waiver.severity !== null && waiver.severity !== finding.severity) return false;
		if (waiver.file !== null && waiver.file !== finding.file) return false;
		if (waiver.title !== null && waiver.title !== finding.title) return false;
		return true;
	});
}

function buildFindingDetail(finding: Readonly<ReviewFinding>): string {
	return sanitizeTemplateContent(
		[
			`Problem: ${finding.problem}`,
			`Evidence: ${finding.evidence}`,
			`Suggested fix: ${finding.fix}`,
		].join("\n"),
	).slice(0, 4096);
}

function toPersistedFindings(
	reviewRunId: string,
	findings: readonly ReviewFinding[],
	policy: Readonly<ReviewPolicy>,
): readonly ReviewRunFinding[] {
	return Object.freeze(
		findings.map((finding, index) =>
			reviewRunFindingSchema.parse({
				findingId: generateFindingId(reviewRunId, index),
				reviewRunId,
				reviewer: finding.agent,
				severity: finding.severity,
				file: finding.file,
				line: finding.line ?? null,
				title: finding.title,
				detail: buildFindingDetail(finding),
				status: matchesWaiver(finding, policy) ? "accepted" : "open",
			}),
		),
	);
}

function buildReviewerCompletionState(
	reviewers: readonly ReviewReviewer[],
	persistedFindings: readonly ReviewRunFinding[],
	executedReviewerNames: readonly string[],
	completedAt: string,
): readonly ReviewReviewer[] {
	const executedSet = new Set(executedReviewerNames);
	return Object.freeze(
		reviewers.map((reviewer) => {
			const findingsCount = persistedFindings.filter(
				(finding) => finding.reviewer === reviewer.reviewer,
			).length;
			if (executedSet.has(reviewer.reviewer)) {
				return reviewReviewerSchema.parse({
					...reviewer,
					status: "COMPLETED",
					findingsCount,
					completedAt,
				});
			}

			if (reviewer.required) {
				return reviewReviewerSchema.parse({
					...reviewer,
					status: "FAILED",
					findingsCount,
					completedAt,
				});
			}

			return reviewReviewerSchema.parse({
				...reviewer,
				status: "SKIPPED",
				findingsCount,
				completedAt,
			});
		}),
	);
}

export async function planReviewRun(
	projectRoot: string,
	options: Readonly<PlanReviewRunOptions>,
): Promise<ReviewRunPlan> {
	const startedAt = options.startedAt ?? new Date().toISOString();
	const reviewRunId = options.reviewRunId ?? generateReviewRunId();
	const changedFiles = await getChangedFilesForReview(
		options.scope,
		projectRoot,
		options.directory,
	);
	const detectedStacks = detectStackTags(changedFiles);
	const diffAnalysis = {
		hasTests: changedFiles.some(
			(filePath) => filePath.includes("test") || filePath.includes("spec"),
		),
		hasAuth: changedFiles.some(
			(filePath) =>
				filePath.includes("auth") || filePath.includes("login") || filePath.includes("session"),
		),
		hasConfig: changedFiles.some(
			(filePath) =>
				filePath.includes("config") || filePath.includes("settings") || filePath.includes(".env"),
		),
		fileCount: changedFiles.length,
	};

	const stageOneCandidates = [...REVIEW_AGENTS, ...SPECIALIZED_AGENTS];
	const stageOneSelection = options.selectedReviewers
		? stageOneCandidates.filter((agent) => options.selectedReviewers?.includes(agent.name))
		: selectAgents(detectedStacks, diffAnalysis, stageOneCandidates, {
				seed: options.runId ?? reviewRunId,
			}).selected;
	const selectedStageOneReviewers = Object.freeze(stageOneSelection.map((agent) => agent.name));
	const policy = buildReviewPolicy({
		selectedStageOneReviewers,
		requiredReviewers: options.requiredReviewers,
		blockingSeverityThreshold: options.blockingSeverityThreshold,
	});
	const reviewers = buildReviewerStates(selectedStageOneReviewers, policy, startedAt);

	const { diff: diffContent, changedFiles: evidenceFiles } = await collectDiffEvidence(
		projectRoot,
		options.scope,
		options.directory,
	);
	const rawDiffEvidence =
		diffContent.length > 0 ? sanitizeTemplateContent(diffContent) : `[Scope: ${options.scope}]`;
	const changedFilesSummary =
		evidenceFiles.length > 0
			? `\n\nChanged files (${evidenceFiles.length}):\n${evidenceFiles.map((filePath) => `- ${filePath}`).join("\n")}`
			: "";
	const diffEvidence = `${rawDiffEvidence}${changedFilesSummary}`;
	const agents = Object.freeze(
		stageOneSelection.map((agent) =>
			Object.freeze({
				name: agent.name,
				prompt: agent.prompt
					.replace("{{DIFF}}", diffEvidence)
					.replace("{{PRIOR_FINDINGS}}", "No prior findings yet.")
					.replace("{{MEMORY}}", ""),
			}),
		),
	);

	const reviewRun = reviewRunSchema.parse({
		reviewRunId,
		runId: options.runId ?? null,
		trancheId: options.trancheId ?? options.runId ?? null,
		scope: options.scope,
		status: "RUNNING",
		verdict: "PENDING",
		policy,
		selectedReviewers: selectedStageOneReviewers,
		reviewers,
		findings: [],
		findingsSummary: createEmptyFindingSummary(),
		summary: null,
		blockedReason: null,
		startedAt,
		completedAt: null,
	});

	return Object.freeze({
		reviewState: Object.freeze({
			stage: 1 as const,
			selectedAgentNames: selectedStageOneReviewers,
			requiredAgentNames: policy.requiredReviewers,
			executedAgentNames: Object.freeze([]),
			reviewRunId,
			blockingSeverityThreshold: policy.blockingSeverityThreshold,
			runId: options.runId ?? null,
			trancheId: options.trancheId ?? options.runId ?? null,
			accumulatedFindings: Object.freeze([]),
			scope: options.scope,
			diffEvidence,
			startedAt,
		}),
		reviewRun,
		agents,
		selectedStageOneReviewers,
	});
}

export function summarizeReviewRun(reviewRun: Readonly<ReviewRun>): ReviewStatus {
	const missingRequiredReviewers = reviewRun.reviewers
		.filter((reviewer) => reviewer.required && reviewer.status !== "COMPLETED")
		.map((reviewer) => reviewer.reviewer);

	return reviewStatusSchema.parse({
		reviewRunId: reviewRun.reviewRunId,
		trancheId: reviewRun.trancheId,
		scope: reviewRun.scope,
		status: reviewRun.status,
		verdict: reviewRun.verdict,
		blockingSeverityThreshold: reviewRun.policy.blockingSeverityThreshold,
		selectedReviewers: reviewRun.selectedReviewers,
		requiredReviewers: reviewRun.policy.requiredReviewers,
		missingRequiredReviewers,
		reviewers: reviewRun.reviewers,
		findingsSummary: reviewRun.findingsSummary,
		summary: reviewRun.summary,
		blockedReason: reviewRun.blockedReason,
		startedAt: reviewRun.startedAt,
		completedAt: reviewRun.completedAt,
	});
}

export function completeReviewRun(
	reviewRun: Readonly<ReviewRun>,
	report: Readonly<ReviewReport>,
	executedReviewerNames: readonly string[],
): ReviewRun {
	const completedAt = report.completedAt;
	const effectiveExecutedReviewers = uniqueStrings(executedReviewerNames);
	const persistedFindings = toPersistedFindings(
		reviewRun.reviewRunId,
		report.findings,
		reviewRun.policy,
	);
	const reviewers = buildReviewerCompletionState(
		reviewRun.reviewers,
		persistedFindings,
		effectiveExecutedReviewers,
		completedAt,
	);
	const missingRequiredReviewers = reviewers
		.filter((reviewer) => reviewer.required && reviewer.status !== "COMPLETED")
		.map((reviewer) => reviewer.reviewer);
	const findingsSummary = buildFindingSummary(
		persistedFindings,
		reviewRun.policy.blockingSeverityThreshold,
	);
	const blockedReason =
		missingRequiredReviewers.length > 0
			? `Required reviewers did not execute: ${missingRequiredReviewers.join(", ")}`
			: findingsSummary.blockingOpen > 0
				? `Open review findings remain at or above ${reviewRun.policy.blockingSeverityThreshold}`
				: null;
	const verdict: Verdict | "PENDING" = blockedReason ? "BLOCKED" : report.verdict;
	const status: ReviewRun["status"] = blockedReason ? "BLOCKED" : "PASSED";
	const summary = formatReviewRunSummary({
		verdict,
		missingRequiredReviewers,
		findingsSummary,
		blockingSeverityThreshold: reviewRun.policy.blockingSeverityThreshold,
	});

	return reviewRunSchema.parse({
		...reviewRun,
		status,
		verdict,
		reviewers,
		findings: persistedFindings,
		findingsSummary,
		summary,
		blockedReason,
		completedAt,
	});
}

export function hasBlockingReviewFindings(reviewRun: Readonly<ReviewRun>): boolean {
	return reviewRun.findings.some(
		(finding) =>
			finding.status === "open" &&
			compareSeverity(finding.severity, reviewRun.policy.blockingSeverityThreshold) <= 0,
	);
}

export function hasRequiredReviewerGap(reviewRun: Readonly<ReviewRun>): boolean {
	return reviewRun.reviewers.some(
		(reviewer) => reviewer.required && reviewer.status !== "COMPLETED",
	);
}

export function buildReviewDispatchPrompt(plan: Readonly<ReviewRunPlan>): string {
	const contract = JSON.stringify({
		reviewRunId: plan.reviewRun.reviewRunId,
		runId: plan.reviewRun.runId,
		trancheId: plan.reviewRun.trancheId,
		scope: plan.reviewRun.scope,
		selectedReviewers: plan.selectedStageOneReviewers,
		requiredReviewers: plan.reviewRun.policy.requiredReviewers,
		blockingSeverityThreshold: plan.reviewRun.policy.blockingSeverityThreshold,
	});

	return [
		"Execute a structured review stage for the completed build wave.",
		"Required reviewers must actually execute before you return.",
		"Return the final JSON output from oc_review unchanged.",
		`Structured review contract: ${contract}`,
	].join("\n");
}

export function buildReviewFixPrompt(
	reviewRun: Readonly<ReviewRun>,
	artifactReference: string,
): string {
	const blockingFindings = reviewRun.findings.filter((finding) => {
		if (finding.status !== "open") return false;
		return compareSeverity(finding.severity, reviewRun.policy.blockingSeverityThreshold) <= 0;
	});
	const findingsText = blockingFindings
		.map(
			(finding) =>
				`- [${finding.severity}] ${finding.title} (${finding.file}${finding.line !== null ? `:${finding.line}` : ""})\n${finding.detail}`,
		)
		.join("\n\n");
	const reviewEvidence =
		findingsText.length > 0
			? findingsText
			: (reviewRun.blockedReason ??
				reviewRun.summary ??
				"Required review policy was not satisfied.");

	return [
		`Review stage blocked shipment. Resolve the following findings at or above ${reviewRun.policy.blockingSeverityThreshold}:`,
		reviewEvidence,
		`Reference ${artifactReference} for context.`,
	].join(" ");
}

export function buildReviewSummaryForPr(reviewStatus: Readonly<ReviewStatus>): string | null {
	if (reviewStatus.status === "IDLE") {
		return null;
	}

	const reviewerSummary = reviewStatus.reviewers
		.map(
			(reviewer) =>
				`${reviewer.required ? "required" : "optional"}: ${reviewer.reviewer} (${reviewer.status})`,
		)
		.join("; ");
	return [reviewStatus.summary, reviewerSummary].filter(Boolean).join(" ").trim() || null;
}

export function buildReviewGateMessage(reviewStatus: Readonly<ReviewStatus>): string | null {
	if (reviewStatus.status === "BLOCKED" && reviewStatus.blockedReason) {
		return reviewStatus.blockedReason;
	}
	if (reviewStatus.missingRequiredReviewers.length > 0) {
		return `Required reviewers missing: ${reviewStatus.missingRequiredReviewers.join(", ")}`;
	}
	if (reviewStatus.findingsSummary.blockingOpen > 0) {
		return `${reviewStatus.findingsSummary.blockingOpen} open review finding(s) remain at or above ${reviewStatus.blockingSeverityThreshold}`;
	}
	return null;
}

export function parseReviewStageResultsEnvelope(raw: string): ReviewStageResultsEnvelope | null {
	try {
		return reviewStageResultsEnvelopeSchema.parse(JSON.parse(raw));
	} catch {
		return null;
	}
}

export function parseReviewCoordinatorResult(raw: string): ReviewCoordinatorResult | null {
	try {
		return reviewCoordinatorResultSchema.parse(JSON.parse(raw));
	} catch {
		return null;
	}
}

export function reviewFindingBlocksPolicy(
	finding: Readonly<ReviewRunFinding>,
	threshold: Severity,
): boolean {
	if (finding.status !== "open") {
		return false;
	}
	return compareSeverity(finding.severity, threshold) <= 0;
}

export function reviewSeverityBlocksShip(severity: Severity, threshold: Severity): boolean {
	if (threshold === "CRITICAL") {
		return isBlockingSeverity(severity);
	}
	return compareSeverity(severity, threshold) <= 0;
}
