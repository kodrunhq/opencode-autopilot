import { AGENT_REGISTRY } from "./model-groups";
import type { AgentOverride, GroupId, GroupModelAssignment, ResolvedModel } from "./types";

const DEPRECATED_AGENT_REMAP: Readonly<Record<string, string>> = Object.freeze({
	documenter: "coder",
	devops: "coder",
	"frontend-engineer": "coder",
	"db-specialist": "coder",
	"oc-explorer": "oc-researcher",
	"oc-retrospector": "oc-shipper",
});

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
 * 2. Deprecated agent remap → resolve via new agent name
 * 3. Agent's group in AGENT_REGISTRY → groups[groupId]
 * 4. null (agent uses OpenCode's default model)
 */
export function resolveModelForAgent(
	agentName: string,
	groups: Readonly<Record<string, GroupModelAssignment>>,
	overrides: Readonly<Record<string, AgentOverride>>,
): ResolvedModel | null {
	const override = overrides[agentName];
	if (override) {
		return {
			primary: override.primary,
			fallbacks: override.fallbacks ?? [],
			source: "override",
		};
	}

	const remappedName = DEPRECATED_AGENT_REMAP[agentName];
	if (remappedName) {
		const remappedOverride = overrides[remappedName];
		if (remappedOverride) {
			return {
				primary: remappedOverride.primary,
				fallbacks: remappedOverride.fallbacks ?? [],
				source: "override",
			};
		}

		const remappedEntry = AGENT_REGISTRY[remappedName];
		if (remappedEntry) {
			const remappedGroup = groups[remappedEntry.group];
			if (remappedGroup) {
				return {
					primary: remappedGroup.primary,
					fallbacks: remappedGroup.fallbacks,
					source: "group",
				};
			}
		}
	}

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

	return null;
}

/**
 * Resolve model for a group directly (used by review pipeline for
 * internal ReviewAgent objects that are not in AGENT_REGISTRY).
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

export { DEPRECATED_AGENT_REMAP };
