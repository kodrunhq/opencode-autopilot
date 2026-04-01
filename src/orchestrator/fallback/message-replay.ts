import type { ContentTier, MessagePart } from "./types";

/**
 * Filters message parts based on content tier.
 *
 * - Tier 1: All parts (full fidelity)
 * - Tier 2: Text + images (filters out tool_call and tool_result)
 * - Tier 3: Text only (maximum compatibility)
 */
export function filterPartsByTier(
	parts: readonly MessagePart[],
	tier: ContentTier,
): readonly MessagePart[] {
	if (tier === 1) return parts;

	if (tier === 2) {
		return parts.filter((part) => part.type !== "tool_call" && part.type !== "tool_result");
	}

	// Tier 3: text only
	return parts.filter((part) => part.type === "text");
}

/**
 * Returns degraded message parts based on the attempt number.
 *
 * - Attempt 0: Tier 1 (all parts)
 * - Attempt 1: Tier 2 (text + images, no tool parts)
 * - Attempt 2+: Tier 3 (text only)
 */
export function replayWithDegradation(
	parts: readonly MessagePart[],
	attempt: number,
): { readonly parts: readonly MessagePart[]; readonly tier: ContentTier } {
	const tier: ContentTier = attempt === 0 ? 1 : attempt === 1 ? 2 : 3;
	return {
		parts: filterPartsByTier(parts, tier),
		tier,
	};
}
