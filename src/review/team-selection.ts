import { AGENT_CATALOG, CORE_SQUAD } from "./agent-catalog";
import { applyStackGate, STACK_GATE_RULES } from "./stack-gate";
import type { AgentDefinition } from "./types";

export interface ReviewContext {
	readonly stackTags: readonly string[];
	readonly changedFiles: readonly string[];
}

export interface ReviewTeam {
	readonly core: readonly AgentDefinition[];
	readonly parallel: readonly AgentDefinition[];
	readonly sequenced: readonly AgentDefinition[];
}

/**
 * Score an agent's relevance to the current review context (0-10).
 * Core squad agents always score 10. Gated agents score based on
 * stack tag match. Universal agents score based on general relevance.
 */
export function scoreAgent(agent: AgentDefinition, context: ReviewContext): number {
	// Core squad always runs -> perfect score
	if (agent.category === "core") {
		return 10;
	}

	const tagSet = new Set(context.stackTags);

	// Check if gated and tags match
	const requiredTags = STACK_GATE_RULES[agent.name];
	if (requiredTags !== undefined) {
		const hasMatch = requiredTags.some((tag) => tagSet.has(tag));
		if (!hasMatch) {
			return 0; // Gated out
		}
		// Gated and matching: high relevance
		return 8;
	}

	// Universal (ungated) agents: score based on affinity
	if (agent.stackAffinity.includes("universal")) {
		return 7; // Always relevant
	}

	// Non-universal, non-gated: moderate relevance
	return 5;
}

/**
 * Select the review team based on project context.
 * Always includes core squad. Filters parallel agents through stack gate.
 * Sequenced agents (product-thinker, red-team) always included.
 */
export function selectReviewTeam(context: ReviewContext): ReviewTeam {
	// Core squad always runs
	const core = CORE_SQUAD;

	// Filter all non-core agents through stack gate
	const nonCoreAgents = AGENT_CATALOG.filter((a) => a.category !== "core");
	const gatePassedAgents = applyStackGate(nonCoreAgents, context.stackTags);

	// Separate parallel and sequenced
	const parallel = gatePassedAgents.filter((a) => a.category === "parallel");
	const sequenced = gatePassedAgents.filter((a) => a.category === "sequenced");

	return { core, parallel, sequenced };
}
