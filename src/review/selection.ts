/**
 * Deterministic agent selection for the review pipeline.
 *
 * Stack gate: agents with empty relevantStacks always pass;
 * agents with non-empty relevantStacks require at least one match.
 */

import { createSeededRandom, deterministicShuffle } from "../utils/random";

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

export interface SelectionOptions {
	/** Seed for reproducible agent ordering. If omitted, uses a fixed default. */
	readonly seed?: string;
	/** Maximum number of gated agents to select. Universal agents are always included. */
	readonly limit?: number;
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
 * @param options - Options for seeding and limiting the number of agents
 * @returns Frozen SelectionResult with selected and excluded lists
 */
export function selectAgents(
	detectedStacks: readonly string[],
	_diffAnalysis: DiffAnalysisInput,
	agents: readonly SelectableAgent[],
	options: SelectionOptions = {},
): SelectionResult {
	const stackSet = new Set(detectedStacks);
	const universal: SelectableAgent[] = [];
	const gatedCandidates: SelectableAgent[] = [];
	const excluded: { readonly agent: string; readonly reason: string }[] = [];

	for (const agent of agents) {
		// Pass 1: Stack gate
		if (agent.relevantStacks.length === 0) {
			// Universal agent -- always passes
			universal.push(agent);
		} else if (agent.relevantStacks.some((s) => stackSet.has(s))) {
			// Gated agent with at least one matching stack
			gatedCandidates.push(agent);
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

	const seed = options.seed ?? "default-selection-seed";
	const rng = createSeededRandom(seed);

	const shuffledGated = deterministicShuffle([...gatedCandidates], rng);
	const finalGated = options.limit ? shuffledGated.slice(0, options.limit) : shuffledGated;

	if (options.limit && finalGated.length < shuffledGated.length) {
		const dropped = shuffledGated.slice(options.limit);
		for (const agent of dropped) {
			excluded.push(
				Object.freeze({
					agent: agent.name,
					reason: `Diversity limit: dropped to meet limit of ${options.limit}`,
				}),
			);
		}
	}

	const combined = [...universal, ...finalGated];
	deterministicShuffle(combined, rng);

	return Object.freeze({
		selected: Object.freeze(combined),
		excluded: Object.freeze(excluded),
	});
}
