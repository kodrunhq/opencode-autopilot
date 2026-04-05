/**
 * Time-weighted decay computation and pruning for memory observations.
 *
 * Relevance score = timeDecay * frequencyWeight * typeWeight
 * - timeDecay: exponential decay with configurable half-life (default 90 days)
 * - frequencyWeight: log2(accessCount + 1), minimum 1
 * - typeWeight: per-type multiplier from constants
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import {
	DEFAULT_HALF_LIFE_DAYS,
	MAX_OBSERVATIONS_PER_PROJECT,
	MIN_RELEVANCE_THRESHOLD,
	TYPE_WEIGHTS,
} from "./constants";
import { getMemoryDb } from "./database";
import { systemTimeProvider, type TimeProvider } from "../scoring/time-provider";
import { deleteObservation, getObservationsByProject } from "./repository";
import type { ObservationType } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Compute the relevance score for an observation.
 *
 * Formula: timeDecay * frequencyWeight * typeWeight
 * - timeDecay = exp(-ageDays / halfLifeDays)
 * - frequencyWeight = max(log2(accessCount + 1), 1)
 * - typeWeight = TYPE_WEIGHTS[type]
 */
export function computeRelevanceScore(
	lastAccessed: string,
	accessCount: number,
	type: ObservationType,
	halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS,
	timeProvider: TimeProvider = systemTimeProvider,
): number {
	const ageMs = timeProvider.now() - new Date(lastAccessed).getTime();
	const ageDays = ageMs / MS_PER_DAY;
	const timeDecay = Math.exp(-ageDays / halfLifeDays);
	const frequencyWeight = Math.max(Math.log2(accessCount + 1), 1);
	const typeWeight = TYPE_WEIGHTS[type];
	return timeDecay * frequencyWeight * typeWeight;
}

/**
 * Prune stale observations for a project.
 *
 * 1. Remove observations where relevance score < MIN_RELEVANCE_THRESHOLD
 * 2. If remaining count > MAX_OBSERVATIONS_PER_PROJECT, remove lowest-scored until at cap
 *
 * Uses deleteObservation for each deletion (not batch DELETE for safety).
 */
export function pruneStaleObservations(
	projectId: string | null,
	db?: Database,
	timeProvider: TimeProvider = systemTimeProvider,
): { readonly pruned: number } {
	const fetchLimit = MAX_OBSERVATIONS_PER_PROJECT + 1000;
	const observations = getObservationsByProject(projectId, fetchLimit, db);

	// Score each observation — skip any without a valid id (schema allows optional)
	const scored = observations
		.filter((obs): obs is typeof obs & { id: number } => obs.id !== undefined)
		.map((obs) => ({
			id: obs.id,
			score: computeRelevanceScore(
				obs.lastAccessed,
				obs.accessCount,
				obs.type,
				DEFAULT_HALF_LIFE_DAYS,
				timeProvider,
			),
		}));

	let pruned = 0;

	// Phase 1: Remove observations below threshold
	const belowThreshold = scored.filter((s) => s.score < MIN_RELEVANCE_THRESHOLD);
	for (const entry of belowThreshold) {
		deleteObservation(entry.id, db);
		pruned++;
	}

	// Phase 2: Enforce cap on remaining
	const remaining = scored
		.filter((s) => s.score >= MIN_RELEVANCE_THRESHOLD)
		.sort((a, b) => a.score - b.score);

	const excess = remaining.length - MAX_OBSERVATIONS_PER_PROJECT;
	if (excess > 0) {
		// Remove lowest-scored excess
		const toRemove = remaining.slice(0, excess);
		for (const entry of toRemove) {
			deleteObservation(entry.id, db);
			pruned++;
		}
	}

	// Optimize the FTS5 index after pruning to reclaim space and improve query speed
	if (pruned > 0) {
		try {
			const resolvedDb = db ?? getMemoryDb();
			resolvedDb.run("INSERT INTO observations_fts(observations_fts) VALUES('optimize')");
		} catch {
			// best-effort — FTS optimize failure is non-critical
		}
	}

	return Object.freeze({ pruned });
}
