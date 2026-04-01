/**
 * Two-pass deterministic agent selection for the review pipeline.
 *
 * Pass 1: Stack gate -- agents with empty relevantStacks always pass;
 *         agents with non-empty relevantStacks require at least one match.
 * Pass 2: Diff relevance scoring -- currently used for future ordering,
 *         all stack-passing agents run regardless of score.
 */

/** Minimal agent shape needed for selection (compatible with ReviewAgent from agents/). */
interface SelectableAgent {
	readonly name: string;
	readonly prompt: string;
	readonly relevantStacks: readonly string[];
	readonly [key: string]: unknown;
}

/** Analysis of changed files (simplified DiffAnalysis). */
export interface DiffAnalysisInput {
	readonly hasTests: boolean;
	readonly hasAuth: boolean;
	readonly hasConfig: boolean;
	readonly fileCount: number;
}

export interface SelectionResult {
	readonly selected: readonly SelectableAgent[];
	readonly excluded: readonly { readonly agent: string; readonly reason: string }[];
}

/**
 * Deterministic two-pass agent selection.
 *
 * @param detectedStacks - Stack tags detected in the project (e.g., ["node", "typescript"])
 * @param diffAnalysis - Analysis of changed files
 * @param agents - All candidate agents
 * @returns Frozen SelectionResult with selected and excluded lists
 */
export function selectAgents(
	detectedStacks: readonly string[],
	diffAnalysis: DiffAnalysisInput,
	agents: readonly SelectableAgent[],
): SelectionResult {
	const stackSet = new Set(detectedStacks);
	const selected: SelectableAgent[] = [];
	const excluded: { readonly agent: string; readonly reason: string }[] = [];

	for (const agent of agents) {
		// Pass 1: Stack gate
		if (agent.relevantStacks.length === 0) {
			// Universal agent -- always passes
			selected.push(agent);
		} else if (agent.relevantStacks.some((s) => stackSet.has(s))) {
			// Gated agent with at least one matching stack
			selected.push(agent);
		} else {
			// Gated agent with no matching stack
			const stackList = detectedStacks.length > 0 ? detectedStacks.join(", ") : "none";
			excluded.push(
				Object.freeze({
					agent: agent.name,
					reason: `Stack gate: ${agent.relevantStacks.join(", ")} not in [${stackList}]`,
				}),
			);
		}
	}

	// Pass 2: Compute relevance scores (stored for future ordering, no filtering)
	// Scores are intentionally not used for filtering yet
	for (const agent of selected) {
		computeDiffRelevance(agent, diffAnalysis);
	}

	return Object.freeze({
		selected: Object.freeze(selected),
		excluded: Object.freeze(excluded),
	});
}

/**
 * Compute diff-based relevance score for an agent.
 * Base score of 1.0 with bonuses for specific agent-analysis matches.
 * Used for future prioritization/ordering, not for filtering.
 */
export function computeDiffRelevance(agent: SelectableAgent, analysis: DiffAnalysisInput): number {
	let score = 1.0;

	if (agent.name === "security-auditor") {
		if (analysis.hasAuth) score += 0.5;
		if (analysis.hasConfig) score += 0.3;
	}

	if (agent.name === "test-interrogator") {
		if (!analysis.hasTests) score += 0.5;
	}

	return score;
}
