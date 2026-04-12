/**
 * oc_review tool -- multi-agent code review with persisted review runs.
 *
 * Stateful between invocations:
 * - scope arg -> start new review (stage 1 dispatch)
 * - findings arg -> advance pipeline to next stage
 * - no args with active state -> return status
 * - no args without state -> error
 *
 * State persisted at {projectRoot}/.opencode-autopilot/current-review.json
 * Memory persisted at {projectRoot}/.opencode-autopilot/review-memory.json
 */

import { randomBytes } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import {
	clearActiveReviewStateInKernel,
	loadActiveReviewStateFromKernel,
	loadReviewRunFromKernel,
	saveActiveReviewStateToKernel,
	saveReviewRunToKernel,
} from "../kernel/repository";
import { getLogger } from "../logging/domains";
import {
	buildReviewDispatchPrompt,
	completeReviewRun,
	parseReviewCoordinatorResult,
	parseReviewStageResultsEnvelope,
	planReviewRun,
	reviewRunSchema,
	summarizeReviewRun,
} from "../orchestrator/review-runner";
import type { ReviewScope } from "../review/diff-evidence";
import {
	createEmptyMemory,
	loadReviewMemory,
	pruneMemory,
	saveReviewMemory,
} from "../review/memory";
import { parseAgentFindings } from "../review/parse-findings";
import type { ReviewState } from "../review/pipeline";
import { advancePipeline } from "../review/pipeline";
import { reviewFindingsEnvelopeSchema, reviewStateSchema } from "../review/schemas";
import type { Severity } from "../review/types";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { getProjectArtifactDir } from "../utils/paths";

interface ReviewArgs {
	readonly scope?: ReviewScope;
	readonly filter?: string;
	readonly directory?: string;
	readonly findings?: string;
	readonly reviewRunId?: string;
	readonly runId?: string;
	readonly trancheId?: string;
	readonly selectedReviewers?: readonly string[];
	readonly requiredReviewers?: readonly string[];
	readonly blockingSeverityThreshold?: Severity;
}

interface NormalizedFindingsInput {
	readonly findingsPayload: string;
	readonly executedReviewerNames: readonly string[];
}

const STATE_FILE = "current-review.json";
let legacyReviewStateMirrorWarned = false;

/**
 * Load review state from disk. Returns null if no active review.
 */
async function loadReviewState(artifactDir: string): Promise<ReviewState | null> {
	const kernelState = loadActiveReviewStateFromKernel(artifactDir);
	if (kernelState !== null) {
		return kernelState;
	}

	const statePath = join(artifactDir, STATE_FILE);
	try {
		const raw = await readFile(statePath, "utf-8");
		const parsed = JSON.parse(raw);
		const validated = reviewStateSchema.parse(parsed) as ReviewState;
		saveActiveReviewStateToKernel(artifactDir, validated);
		return validated;
	} catch (error: unknown) {
		if (isEnoentError(error)) return null;
		if (error instanceof SyntaxError || (error && typeof error === "object" && "issues" in error)) {
			try {
				await unlink(statePath);
			} catch {
				/* ignore cleanup errors */
			}
			return null;
		}
		throw error;
	}
}

async function writeLegacyReviewStateMirror(
	state: ReviewState,
	artifactDir: string,
): Promise<void> {
	await ensureDir(artifactDir);
	const statePath = join(artifactDir, STATE_FILE);
	const tmpPath = `${statePath}.tmp.${randomBytes(8).toString("hex")}`;
	await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf-8");
	await rename(tmpPath, statePath);
}

async function syncLegacyReviewStateMirror(state: ReviewState, artifactDir: string): Promise<void> {
	try {
		await writeLegacyReviewStateMirror(state, artifactDir);
	} catch (error: unknown) {
		if (!legacyReviewStateMirrorWarned) {
			legacyReviewStateMirrorWarned = true;
			getLogger("tool", "review").warn("current-review.json mirror write failed", { error });
		}
	}
}

/**
 * Save review state atomically.
 */
async function saveReviewState(state: ReviewState, artifactDir: string): Promise<void> {
	const validated = reviewStateSchema.parse(state);
	saveActiveReviewStateToKernel(artifactDir, validated);
	await syncLegacyReviewStateMirror(validated, artifactDir);
}

/**
 * Delete review state file (pipeline complete or error cleanup).
 */
export async function clearReviewState(artifactDir: string): Promise<void> {
	clearActiveReviewStateInKernel(artifactDir);
	const statePath = join(artifactDir, STATE_FILE);
	try {
		await unlink(statePath);
	} catch (error: unknown) {
		if (!isEnoentError(error)) throw error;
	}
}

function uniqueStrings(values: readonly string[]): readonly string[] {
	return Object.freeze([...new Set(values)]);
}

async function buildTransientReviewRun(args: {
	readonly artifactDir: string;
	readonly projectRoot: string;
	readonly currentState: ReviewState;
}) {
	const existingRun = loadReviewRunFromKernel(args.artifactDir, args.currentState.reviewRunId);
	if (existingRun !== null) {
		return existingRun;
	}

	const plan = await planReviewRun(args.projectRoot, {
		scope: args.currentState.scope as ReviewScope,
		directory: undefined,
		runId: args.currentState.runId,
		trancheId: args.currentState.trancheId,
		reviewRunId: args.currentState.reviewRunId,
		selectedReviewers: args.currentState.selectedAgentNames,
		requiredReviewers: args.currentState.requiredAgentNames,
		blockingSeverityThreshold: args.currentState.blockingSeverityThreshold,
		startedAt: args.currentState.startedAt,
	});
	return reviewRunSchema.parse(plan.reviewRun);
}

function normalizeFindingsInput(raw: string): NormalizedFindingsInput {
	const stageResultsEnvelope = parseReviewStageResultsEnvelope(raw);
	if (stageResultsEnvelope !== null) {
		const normalizedFindings = stageResultsEnvelope.results.flatMap((result) =>
			parseAgentFindings(JSON.stringify({ findings: result.findings }), result.reviewer),
		);
		return {
			findingsPayload: JSON.stringify(
				reviewFindingsEnvelopeSchema.parse({
					schemaVersion: 1,
					kind: "review_findings",
					findings: normalizedFindings,
				}),
			),
			executedReviewerNames: uniqueStrings(
				stageResultsEnvelope.results.map((result) => result.reviewer),
			),
		};
	}

	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (
			parsed &&
			typeof parsed === "object" &&
			"report" in parsed &&
			typeof parsed.report === "object" &&
			parsed.report !== null &&
			Array.isArray((parsed.report as { findings?: unknown }).findings)
		) {
			const report = parsed.report as {
				findings: unknown[];
				executedReviewers?: unknown;
			};
			return {
				findingsPayload: JSON.stringify(
					reviewFindingsEnvelopeSchema.parse({
						schemaVersion: 1,
						kind: "review_findings",
						findings: report.findings,
					}),
				),
				executedReviewerNames: Array.isArray(report.executedReviewers)
					? uniqueStrings(
							report.executedReviewers.filter(
								(value): value is string => typeof value === "string",
							),
						)
					: Object.freeze([]),
			};
		}
	} catch {
		// keep legacy payload for parser fallback
	}

	const coordinatorResult = parseReviewCoordinatorResult(raw);
	if (coordinatorResult?.report) {
		return {
			findingsPayload: JSON.stringify(
				reviewFindingsEnvelopeSchema.parse({
					schemaVersion: 1,
					kind: "review_findings",
					findings: coordinatorResult.report.findings,
				}),
			),
			executedReviewerNames: uniqueStrings(coordinatorResult.report.executedReviewers ?? []),
		};
	}

	return {
		findingsPayload: raw,
		executedReviewerNames: Object.freeze([]),
	};
}

export async function reviewCore(args: ReviewArgs, projectRoot: string): Promise<string> {
	try {
		const artifactDir = getProjectArtifactDir(projectRoot);
		const currentState = await loadReviewState(artifactDir);

		if (currentState === null && args.scope) {
			const plan = await planReviewRun(projectRoot, {
				scope: args.scope,
				directory: args.directory,
				runId: args.runId ?? null,
				trancheId: args.trancheId ?? args.runId ?? null,
				reviewRunId: args.reviewRunId,
				selectedReviewers: args.selectedReviewers,
				requiredReviewers: args.requiredReviewers,
				blockingSeverityThreshold: args.blockingSeverityThreshold,
			});

			const memory = await loadReviewMemory(projectRoot);
			if (memory) {
				// Future enhancement: use false-positive memory to alter prompts.
			}

			const state = reviewStateSchema.parse(plan.reviewState);
			await saveReviewState(state, artifactDir);
			saveReviewRunToKernel(artifactDir, plan.reviewRun);

			return JSON.stringify({
				action: "dispatch",
				stage: 1,
				agents: plan.agents,
				reviewRunId: plan.reviewRun.reviewRunId,
				selectedReviewers: plan.selectedStageOneReviewers,
				requiredReviewers: plan.reviewRun.policy.requiredReviewers,
				reviewStatus: summarizeReviewRun(plan.reviewRun),
				reviewPrompt: buildReviewDispatchPrompt(plan),
				submissionFormat: {
					schemaVersion: 1,
					kind: "review_stage_results",
					results: [{ reviewer: "logic-auditor", status: "completed", findings: [] }],
				},
			});
		}

		if (currentState === null && !args.scope) {
			return JSON.stringify({
				action: "error",
				message: "No active review. Provide scope to start.",
			});
		}

		if (currentState !== null && args.findings) {
			const normalizedInput = normalizeFindingsInput(args.findings);
			const result = advancePipeline(
				normalizedInput.findingsPayload,
				currentState,
				"unknown",
				args.runId,
				args.runId,
				{ executedAgentNames: normalizedInput.executedReviewerNames },
			);

			if (result.action === "dispatch" && result.state) {
				await saveReviewState(result.state, artifactDir);
				return JSON.stringify({
					action: "dispatch",
					stage: result.stage,
					agents: result.agents,
					message: result.message,
					parseMode: result.parseMode,
					reviewRunId: currentState.reviewRunId,
				});
			}

			if (result.action === "complete" && result.report) {
				const reviewRun = completeReviewRun(
					await buildTransientReviewRun({ artifactDir, projectRoot, currentState }),
					result.report,
					normalizedInput.executedReviewerNames.length > 0
						? normalizedInput.executedReviewerNames
						: result.report.executedReviewers,
				);
				saveReviewRunToKernel(artifactDir, reviewRun);

				const memory = (await loadReviewMemory(projectRoot)) ?? createEmptyMemory();
				const updatedMemory = pruneMemory({
					...memory,
					recentFindings: [...memory.recentFindings, ...(result.report.findings ?? [])],
					lastReviewedAt: new Date().toISOString(),
				});
				await saveReviewMemory(updatedMemory, projectRoot);

				await clearReviewState(artifactDir);

				return JSON.stringify({
					action: "complete",
					report: result.report,
					findingsEnvelope: result.findingsEnvelope,
					parseMode: result.parseMode,
					reviewRun,
					reviewStatus: summarizeReviewRun(reviewRun),
					reviewRunId: reviewRun.reviewRunId,
					selectedReviewers: reviewRun.reviewers.map((reviewer) => reviewer.reviewer),
					requiredReviewers: reviewRun.policy.requiredReviewers,
					executedReviewers: reviewRun.reviewers
						.filter((reviewer) => reviewer.status === "COMPLETED")
						.map((reviewer) => reviewer.reviewer),
					missingRequiredReviewers: reviewRun.reviewers
						.filter((reviewer) => reviewer.required && reviewer.status !== "COMPLETED")
						.map((reviewer) => reviewer.reviewer),
				});
			}

			if (result.action === "error") {
				const existingRun = await buildTransientReviewRun({
					artifactDir,
					projectRoot,
					currentState,
				});
				const failedReviewRun = reviewRunSchema.parse({
					...existingRun,
					status: "FAILED",
					verdict: "BLOCKED",
					summary: result.message ?? "Review pipeline error",
					blockedReason: result.message ?? "Review pipeline error",
					completedAt: new Date().toISOString(),
				});
				saveReviewRunToKernel(artifactDir, failedReviewRun);
				await clearReviewState(artifactDir);
				return JSON.stringify({
					action: "error",
					message: result.message ?? "Pipeline error",
					reviewRunId: failedReviewRun.reviewRunId,
					reviewStatus: summarizeReviewRun(failedReviewRun),
				});
			}
		}

		if (currentState !== null && !args.findings) {
			const reviewRun = loadReviewRunFromKernel(artifactDir, currentState.reviewRunId);
			return JSON.stringify({
				action: "status",
				stage: currentState.stage,
				message: "Awaiting findings from dispatched agents",
				reviewRunId: currentState.reviewRunId,
				reviewStatus: reviewRun ? summarizeReviewRun(reviewRun) : undefined,
			});
		}

		return JSON.stringify({ action: "error", message: "Unexpected state" });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return JSON.stringify({ action: "error", message });
	}
}

export const ocReview = tool({
	description:
		"Run multi-agent code review. Provide scope to start, or findings from dispatched reviewers to advance the pipeline. Returns JSON with action (dispatch|complete|status|error) plus persisted review-run metadata.",
	args: {
		scope: tool.schema
			.enum(["staged", "unstaged", "branch", "all", "directory"])
			.optional()
			.describe("Review scope"),
		filter: tool.schema.string().optional().describe("Regex pattern to filter files"),
		directory: tool.schema.string().optional().describe("Directory path for directory scope"),
		findings: tool.schema
			.string()
			.optional()
			.describe(
				"JSON findings or review_stage_results envelope from previously dispatched review agents",
			),
		reviewRunId: tool.schema.string().optional().describe("Existing reviewRunId to reuse"),
		runId: tool.schema.string().optional().describe("Pipeline runId associated with this review"),
		trancheId: tool.schema
			.string()
			.optional()
			.describe("Program trancheId associated with this review"),
		selectedReviewers: tool.schema
			.array(tool.schema.string())
			.optional()
			.describe("Pinned stage-one reviewers to use instead of auto-selection"),
		requiredReviewers: tool.schema
			.array(tool.schema.string())
			.optional()
			.describe("Reviewers that must execute before the review can pass"),
		blockingSeverityThreshold: tool.schema
			.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"])
			.optional()
			.describe("Minimum severity that blocks shipment while findings stay open"),
	},
	async execute(args, context) {
		return reviewCore(args, context.directory);
	},
});
