/**
 * Two-tier fallback chain resolution.
 *
 * Tier 1: Per-agent fallback_models from opencode.json agent config
 * Tier 2: Global fallback_models from plugin config
 *
 * Normalizes a single string to a single-element array.
 * Always returns a new array (no shared references).
 */
export function resolveChain(
	agentName: string,
	agentConfigs: Record<string, Record<string, unknown>> | undefined,
	globalFallbacks: string | readonly string[] | undefined,
): string[] {
	// Tier 1: Per-agent fallback_models
	if (agentConfigs?.[agentName]) {
		const perAgent = agentConfigs[agentName].fallback_models;
		if (perAgent) {
			if (typeof perAgent === "string") return [perAgent];
			if (Array.isArray(perAgent)) return [...perAgent];
		}
	}

	// Tier 2: Global fallback_models
	if (globalFallbacks) {
		if (typeof globalFallbacks === "string") return [globalFallbacks];
		if (Array.isArray(globalFallbacks)) return [...globalFallbacks];
	}

	return [];
}
