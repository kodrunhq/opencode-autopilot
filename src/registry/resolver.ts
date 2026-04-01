import { AGENT_REGISTRY } from "./model-groups";
import type { AgentOverride, GroupId, GroupModelAssignment, ResolvedModel } from "./types";

/**
 * Extract model family (provider) from a model string.
 * "anthropic/claude-opus-4-6" → "anthropic"
 * "openai/gpt-5.4" → "openai"
 * Returns the full string if no "/" is found.
 */
export function extractFamily(model: string): string {
	const idx = model.indexOf("/");
	return idx === -1 ? model : model.slice(0, idx);
}

/**
 * Resolve model for a named agent.
 *
 * Resolution order:
 * 1. Per-agent override in overrides[agentName]
 * 2. Agent's group in AGENT_REGISTRY → groups[groupId]
 * 3. null (agent uses OpenCode's default model)
 */
export function resolveModelForAgent(
	agentName: string,
	groups: Readonly<Record<string, GroupModelAssignment>>,
	overrides: Readonly<Record<string, AgentOverride>>,
): ResolvedModel | null {
	// Tier 1: per-agent override
	const override = overrides[agentName];
	if (override) {
		return {
			primary: override.primary,
			fallbacks: override.fallbacks ?? [],
			source: "override",
		};
	}

	// Tier 2: group assignment
	const entry = AGENT_REGISTRY[agentName];
	if (entry) {
		const group = groups[entry.group];
		if (group) {
			return {
				primary: group.primary,
				fallbacks: group.fallbacks,
				source: "group",
			};
		}
	}

	// Tier 3: no assignment
	return null;
}

/**
 * Resolve model for a group directly (used by review pipeline for
 * internal ReviewAgent objects that are not in AGENT_REGISTRY).
 *
 * Used by:
 * - Review pipeline for the 19 universal+specialized agents → "reviewers"
 * - Review pipeline for red-team + product-thinker → "red-team"
 */
export function resolveModelForGroup(
	groupId: GroupId,
	groups: Readonly<Record<string, GroupModelAssignment>>,
): ResolvedModel | null {
	const group = groups[groupId];
	if (!group) return null;
	return {
		primary: group.primary,
		fallbacks: group.fallbacks,
		source: "group",
	};
}
