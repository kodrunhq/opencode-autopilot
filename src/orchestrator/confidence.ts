import type { ConfidenceEntry, Phase, PipelineState } from "./types";

type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

const LEVEL_PRIORITY: readonly ConfidenceLevel[] = ["HIGH", "MEDIUM", "LOW"] as const;

export function appendConfidence(
	state: Readonly<PipelineState>,
	entry: Omit<ConfidenceEntry, "timestamp">,
): PipelineState {
	return {
		...state,
		confidence: [
			...state.confidence,
			{
				...entry,
				timestamp: new Date().toISOString(),
			},
		],
		lastUpdatedAt: new Date().toISOString(),
	};
}

export function summarizeConfidence(entries: readonly ConfidenceEntry[]): {
	HIGH: number;
	MEDIUM: number;
	LOW: number;
	total: number;
	dominant: ConfidenceLevel;
} {
	const counts: Record<ConfidenceLevel, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };

	for (const entry of entries) {
		counts[entry.level]++;
	}

	const total = entries.length;

	// Default: no evidence of low confidence → assume HIGH (single-proposal fast path).
	// This prevents empty ledgers from triggering expensive multi-proposal arena (depth=2).
	let dominant: ConfidenceLevel = "HIGH";
	if (total > 0) {
		let maxCount = 0;
		for (const level of LEVEL_PRIORITY) {
			if (counts[level] > maxCount) {
				maxCount = counts[level];
				dominant = level;
			}
		}
	}

	return { ...counts, total, dominant };
}

export function filterByPhase(
	entries: readonly ConfidenceEntry[],
	phase: Phase,
): readonly ConfidenceEntry[] {
	return entries.filter((entry) => entry.phase === phase);
}
