import { summarizeConfidence } from "./confidence";
import type { ConfidenceEntry } from "./types";

type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

const DEPTH_MAP: Readonly<Record<ConfidenceLevel, number>> = Object.freeze({
	HIGH: 1,
	MEDIUM: 2,
	LOW: 3,
});

const LEVEL_ORDER: Readonly<Record<ConfidenceLevel, number>> = Object.freeze({
	HIGH: 3,
	MEDIUM: 2,
	LOW: 1,
});

/**
 * Determines arena debate depth based on aggregate confidence.
 * LOW confidence -> 3 proposals, MEDIUM -> 2, HIGH -> 1.
 */
export function getDebateDepth(entries: readonly ConfidenceEntry[]): number {
	const { dominant } = summarizeConfidence(entries);
	return DEPTH_MAP[dominant];
}

/**
 * Returns true if any confidence entry is below the given threshold.
 * Empty entries returns false.
 */
export function shouldTriggerExplorer(
	entries: readonly ConfidenceEntry[],
	threshold: ConfidenceLevel = "MEDIUM",
): boolean {
	if (entries.length === 0) {
		return false;
	}

	const thresholdOrder = LEVEL_ORDER[threshold];
	return entries.some((entry) => LEVEL_ORDER[entry.level] < thresholdOrder);
}
