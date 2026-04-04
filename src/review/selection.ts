/**
 * Deterministic agent selection for the review pipeline.
 *
 * Stack gate: agents with empty relevantStacks always pass;
 * agents with non-empty relevantStacks require at least one match.
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
	_diffAnalysis: DiffAnalysisInput,
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

	return Object.freeze({
		selected: Object.freeze(selected),
		excluded: Object.freeze(excluded),
	});
}
