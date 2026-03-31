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

import { REVIEW_AGENTS, STAGE3_AGENTS } from "./agents/index";
import { buildCrossVerificationPrompts, condenseFinding } from "./cross-verification";
import { buildFixInstructions, determineFixableFindings } from "./fix-cycle";
import { buildReport } from "./report";
import { reviewFindingSchema } from "./schemas";
import type { ReviewFinding, ReviewReport, ReviewState } from "./types";

export type { ReviewState };

import { sanitizeTemplateContent } from "./sanitize";

/** Result of a pipeline step -- either dispatch more agents or return the final report. */
export interface ReviewStageResult {
	readonly action: "dispatch" | "complete" | "error";
	readonly stage?: number;
	readonly agents?: readonly { readonly name: string; readonly prompt: string }[];
	readonly report?: ReviewReport;
	readonly message?: string;
	readonly state?: ReviewState;
}

/**
 * Parse findings from raw LLM output (which may contain markdown, prose, code blocks).
 *
 * Handles:
 * - {"findings": [...]} wrapper
 * - Raw array [{...}, ...]
 * - JSON embedded in markdown code blocks
 * - Prose with embedded JSON
 *
 * Sets agent field to agentName if missing from individual findings.
 * Validates each finding through reviewFindingSchema, discards invalid ones.
 */
export function parseAgentFindings(raw: string, agentName: string): readonly ReviewFinding[] {
	const findings: ReviewFinding[] = [];

	// Try to extract JSON from the raw text
	const jsonStr = extractJson(raw);
	if (jsonStr === null) return Object.freeze(findings);

	try {
		const parsed = JSON.parse(jsonStr);
		const items = Array.isArray(parsed) ? parsed : parsed?.findings;

		if (!Array.isArray(items)) return Object.freeze(findings);

		for (const item of items) {
			// Set agent field if missing
			const withAgent = item.agent ? item : { ...item, agent: agentName };
			const result = reviewFindingSchema.safeParse(withAgent);
			if (result.success) {
				findings.push(result.data);
			}
		}
	} catch {
		// JSON parse failed -- return empty
	}

	return Object.freeze(findings);
}

/**
 * Extract the first JSON object or array from raw text.
 * Looks for:
 * 1. JSON inside markdown code blocks
 * 2. {"findings": ...} pattern
 * 3. Raw array [{...}]
 */
function extractJson(raw: string): string | null {
	// Try markdown code block extraction first
	const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
	if (codeBlockMatch) {
		return codeBlockMatch[1].trim();
	}

	// Try to find {"findings": ...} or [{...}]
	const objectStart = raw.indexOf("{");
	const arrayStart = raw.indexOf("[");

	if (objectStart === -1 && arrayStart === -1) return null;

	// Pick whichever comes first
	const start =
		objectStart === -1
			? arrayStart
			: arrayStart === -1
				? objectStart
				: Math.min(objectStart, arrayStart);

	// Find matching close bracket (string-literal-aware depth tracking)
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < raw.length; i++) {
		const ch = raw[i];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (ch === "\\" && inString) {
			escaped = true;
			continue;
		}
		if (ch === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (ch === "{" || ch === "[") depth++;
		if (ch === "}" || ch === "]") depth--;
		if (depth === 0) {
			return raw.slice(start, i + 1);
		}
	}

	return null;
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
): ReviewStageResult {
	// Parse new findings
	const newFindings = parseAgentFindings(findingsJson, agentName);
	const accumulated = [...currentState.accumulatedFindings, ...newFindings];

	const nextStage = currentState.stage + 1;

	switch (currentState.stage) {
		case 1: {
			// Stage 1 -> 2: Build cross-verification prompts
			const agents = REVIEW_AGENTS.filter((a) => currentState.selectedAgentNames.includes(a.name));
			const findingsByAgent = groupFindingsByAgent(accumulated);
			const sanitizedScope = sanitizeTemplateContent(currentState.scope);
			const prompts = buildCrossVerificationPrompts(agents, findingsByAgent, sanitizedScope);
			const newState: ReviewState = {
				...currentState,
				stage: nextStage,
				accumulatedFindings: accumulated,
			};
			return Object.freeze({
				action: "dispatch" as const,
				stage: nextStage,
				agents: prompts,
				state: newState,
			});
		}

		case 2: {
			// Stage 2 -> 3: Build red-team + product-thinker prompts
			const condensed = sanitizeTemplateContent(accumulated.map(condenseFinding).join("\n"));
			const sanitizedScope2 = sanitizeTemplateContent(currentState.scope);
			const stage3Prompts = STAGE3_AGENTS.map((agent) => ({
				name: agent.name,
				prompt: agent.prompt
					.replace("{{DIFF}}", sanitizedScope2)
					.replace("{{PRIOR_FINDINGS}}", condensed)
					.replace("{{MEMORY}}", ""),
			}));
			const newState: ReviewState = {
				...currentState,
				stage: nextStage,
				accumulatedFindings: accumulated,
			};
			return Object.freeze({
				action: "dispatch" as const,
				stage: nextStage,
				agents: Object.freeze(stage3Prompts.map((p) => Object.freeze(p))),
				state: newState,
			});
		}

		case 3: {
			// Stage 3 -> 4 or complete: Check for actionable CRITICAL fixes
			const fixResult = determineFixableFindings(accumulated);
			if (fixResult.fixable.length > 0) {
				// Build fix-cycle prompts for agents whose findings are fixable
				const allAgents = [...REVIEW_AGENTS, ...STAGE3_AGENTS];
				const sanitizedScope3 = sanitizeTemplateContent(currentState.scope);
				const fixAgents = buildFixInstructions(fixResult.fixable, allAgents, sanitizedScope3);
				const newState: ReviewState = {
					...currentState,
					stage: nextStage,
					accumulatedFindings: accumulated,
				};
				return Object.freeze({
					action: "dispatch" as const,
					stage: nextStage,
					message: "Fix cycle: CRITICAL findings with actionable suggestions detected.",
					agents: Object.freeze(fixAgents),
					state: newState,
				});
			}
			// No fix cycle needed -- complete
			const report = buildReport(accumulated, currentState.scope, currentState.selectedAgentNames);
			return Object.freeze({ action: "complete" as const, report });
		}

		case 4: {
			// Stage 4 -> complete: Build final report with all findings
			const report = buildReport(accumulated, currentState.scope, currentState.selectedAgentNames);
			return Object.freeze({ action: "complete" as const, report });
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
