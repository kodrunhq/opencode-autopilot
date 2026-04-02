import type { Database } from "bun:sqlite";
import { getObservationsByProject, getProjectByPath } from "../memory/repository";
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

/** Minimum error observations to trigger deeper review. */
const ERROR_DEPTH_THRESHOLD = 3;

/**
 * Memory-tuned debate depth: adjusts arena depth based on project error history.
 * Scans the 50 most-recent observations (recency window) — older errors are not counted.
 * Projects with 3+ error observations in the window get deeper review (+1, capped at 3).
 * Best-effort: memory errors never affect pipeline (falls back to standard depth).
 */
export function getMemoryTunedDepth(
	entries: readonly ConfidenceEntry[],
	projectPath: string,
	db?: Database,
): number {
	const baseDepth = getDebateDepth(entries);
	try {
		const project = getProjectByPath(projectPath, db);
		if (!project) return baseDepth;
		const observations = getObservationsByProject(project.id, 50, db);
		const errorCount = observations.filter((o) => o.type === "error").length;
		if (errorCount >= ERROR_DEPTH_THRESHOLD) {
			return Math.min(baseDepth + 1, 3);
		}
	} catch (err) {
		console.warn("[opencode-autopilot] memory-tuned depth failed, using base:", err);
	}
	return baseDepth;
}
