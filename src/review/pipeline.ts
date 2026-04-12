/**
 * Review pipeline state machine.
 *
 * 4-stage flow:
 *   Stage 1: Dispatch specialist agents with diff
 *   Stage 2: Cross-verification (agents review each other's findings)
 *   Stage 3: Red-team + product-thinker with all accumulated findings
 *   Stage 4: Final report (or fix cycle if CRITICAL findings with actionable fixes)
 *
 * The pipeline returns dispatch instructions -- it does NOT dispatch agents itself.
 * The orchestrator is responsible for sending prompts to agents and collecting results.
 */

import { ALL_REVIEW_AGENTS, STAGE3_AGENTS } from "./agents/index";
import { buildCrossVerificationPrompts, condenseFinding } from "./cross-verification";

/** Derived set of stage-3 agent names — avoids hardcoding names in pipeline logic. */
const STAGE3_NAMES: ReadonlySet<string> = new Set(STAGE3_AGENTS.map((a) => a.name));

import { buildFixInstructions, determineFixableFindings } from "./fix-cycle";
import { parseAgentFindings, parseTypedFindingsEnvelope } from "./parse-findings";
import { buildReport } from "./report";
import type { ReviewFinding, ReviewFindingsEnvelope, ReviewReport, ReviewState } from "./types";

export type { ReviewState };

import { sanitizeTemplateContent } from "./sanitize";

/** Result of a pipeline step -- either dispatch more agents or return the final report. */
export interface ReviewStageResult {
	readonly action: "dispatch" | "complete" | "error";
	readonly stage?: number;
	readonly agents?: readonly { readonly name: string; readonly prompt: string }[];
	readonly report?: ReviewReport;
	readonly findingsEnvelope?: ReviewFindingsEnvelope;
	readonly message?: string;
	readonly state?: ReviewState;
	readonly parseMode?: "typed" | "legacy";
}

export interface AdvancePipelineOptions {
	readonly executedAgentNames?: readonly string[];
}

/**
 * Advance the pipeline from the current stage to the next.
 *
 * @param findingsJson - Raw JSON string of findings from the current stage's agents
 * @param currentState - Current pipeline state
 * @returns Next stage's dispatch instructions or final report
 */
export function advancePipeline(
	findingsJson: string,
	currentState: ReviewState,
	agentName = "unknown",
	_runId?: string,
	_seed?: string,
	options?: AdvancePipelineOptions,
): ReviewStageResult {
	const typedEnvelope = parseTypedFindingsEnvelope(findingsJson);
	const parseMode = typedEnvelope ? "typed" : "legacy";
	const newFindings = typedEnvelope
		? typedEnvelope.findings
		: parseAgentFindings(findingsJson, agentName);
	const accumulated = [...currentState.accumulatedFindings, ...newFindings];
	const executedAgentNames = [
		...new Set([
			...(currentState.executedAgentNames ?? []),
			...(options?.executedAgentNames ?? []),
		]),
	];

	const nextStage = currentState.stage + 1;

	switch (currentState.stage) {
		case 1: {
			// Stage 1 -> 2: Build cross-verification prompts from all selected agents (excluding stage 3)
			const agents = ALL_REVIEW_AGENTS.filter(
				(a) => currentState.selectedAgentNames.includes(a.name) && !STAGE3_NAMES.has(a.name),
			);
			const findingsByAgent = groupFindingsByAgent(accumulated);
			const sanitizedScope = sanitizeTemplateContent(currentState.scope);
			const prompts = buildCrossVerificationPrompts(agents, findingsByAgent, sanitizedScope);
			const newState: ReviewState = {
				...currentState,
				stage: nextStage,
				accumulatedFindings: accumulated,
				executedAgentNames,
			};
			return Object.freeze({
				action: "dispatch" as const,
				stage: nextStage,
				agents: prompts,
				parseMode,
				state: newState,
			});
		}

		case 2: {
			// Stage 2 -> 3: Build red-team + product-thinker prompts
			const condensed = sanitizeTemplateContent(accumulated.map(condenseFinding).join("\n"));
			const sanitizedScope2 = sanitizeTemplateContent(currentState.scope);
			const diffEvidence = currentState.diffEvidence ?? sanitizedScope2;
			const stage3Prompts = STAGE3_AGENTS.map((agent) => ({
				name: agent.name,
				prompt: agent.prompt
					.replace("{{DIFF}}", diffEvidence)
					.replace("{{PRIOR_FINDINGS}}", condensed)
					.replace("{{MEMORY}}", ""),
			}));
			const newState: ReviewState = {
				...currentState,
				stage: nextStage,
				accumulatedFindings: accumulated,
				executedAgentNames,
			};
			return Object.freeze({
				action: "dispatch" as const,
				stage: nextStage,
				agents: Object.freeze(stage3Prompts.map((p) => Object.freeze(p))),
				parseMode,
				state: newState,
			});
		}

		case 3: {
			// Stage 3 -> 4 or complete: Check for actionable CRITICAL fixes
			const fixResult = determineFixableFindings(accumulated);
			if (fixResult.fixable.length > 0) {
				// Build fix-cycle prompts for agents whose findings are fixable
				const allAgents = ALL_REVIEW_AGENTS.filter(
					(a) => currentState.selectedAgentNames.includes(a.name) || STAGE3_NAMES.has(a.name),
				);
				const sanitizedScope3 = sanitizeTemplateContent(currentState.scope);
				const fixAgents = buildFixInstructions(fixResult.fixable, allAgents, sanitizedScope3);
				const newState: ReviewState = {
					...currentState,
					stage: nextStage,
					accumulatedFindings: accumulated,
					executedAgentNames,
				};
				return Object.freeze({
					action: "dispatch" as const,
					stage: nextStage,
					message: "Fix cycle: CRITICAL findings with actionable suggestions detected.",
					agents: Object.freeze(fixAgents),
					parseMode,
					state: newState,
				});
			}
			// No fix cycle needed -- complete
			const report = buildReport(accumulated, currentState.scope, executedAgentNames, {
				reviewRunId: currentState.reviewRunId,
				selectedReviewers: currentState.selectedAgentNames,
				requiredReviewers: currentState.requiredAgentNames,
				executedReviewers: executedAgentNames,
				missingRequiredReviewers: currentState.requiredAgentNames.filter(
					(reviewer) => !executedAgentNames.includes(reviewer),
				),
				blockingSeverityThreshold: currentState.blockingSeverityThreshold,
			});
			return Object.freeze({
				action: "complete" as const,
				report,
				findingsEnvelope: Object.freeze({
					schemaVersion: 1 as const,
					kind: "review_findings" as const,
					findings: accumulated,
				}),
				parseMode,
			});
		}

		case 4: {
			// Stage 4 -> complete: Build final report with all findings
			const report = buildReport(accumulated, currentState.scope, executedAgentNames, {
				reviewRunId: currentState.reviewRunId,
				selectedReviewers: currentState.selectedAgentNames,
				requiredReviewers: currentState.requiredAgentNames,
				executedReviewers: executedAgentNames,
				missingRequiredReviewers: currentState.requiredAgentNames.filter(
					(reviewer) => !executedAgentNames.includes(reviewer),
				),
				blockingSeverityThreshold: currentState.blockingSeverityThreshold,
			});
			return Object.freeze({
				action: "complete" as const,
				report,
				findingsEnvelope: Object.freeze({
					schemaVersion: 1 as const,
					kind: "review_findings" as const,
					findings: accumulated,
				}),
				parseMode,
			});
		}

		default:
			return Object.freeze({
				action: "error" as const,
				message: `Unknown stage: ${currentState.stage}`,
			});
	}
}

/**
 * Group findings by agent name.
 */
function groupFindingsByAgent(
	findings: readonly ReviewFinding[],
): ReadonlyMap<string, readonly ReviewFinding[]> {
	const grouped = new Map<string, ReviewFinding[]>();
	for (const f of findings) {
		const group = grouped.get(f.agent);
		if (group) {
			group.push(f);
		} else {
			grouped.set(f.agent, [f]);
		}
	}
	return grouped;
}
