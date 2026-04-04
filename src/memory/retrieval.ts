/**
 * 3-layer progressive disclosure retrieval with token-budgeted context building.
 *
 * Layer 1 (always): Observation summaries grouped by type (up to 5 per group)
 * Layer 2 (if budget allows): Recent Activity timeline
 * Layer 3 (if budget allows): Full content for top 1-2 observations
 *
 * Token budget enforcement: never exceeds CHARS_PER_TOKEN * tokenBudget characters.
 * Same approach as buildMultiSkillContext in src/skills/adaptive-injector.ts.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { CHARS_PER_TOKEN, DEFAULT_INJECTION_BUDGET } from "./constants";
import { getMemoryDb } from "./database";
import { computeRelevanceScore } from "./decay";
import {
	getAllPreferences,
	getObservationsByProject,
	getProjectByPath,
	updateAccessCount,
} from "./repository";
import type { Observation, Preference } from "./types";

/**
 * An observation with its computed relevance score.
 */
export type ScoredObservation = Observation & { readonly relevanceScore: number };

/**
 * Score and rank observations by relevance (descending).
 */
export function scoreAndRankObservations(
	observations: readonly Observation[],
	halfLifeDays?: number,
): readonly ScoredObservation[] {
	return observations
		.map((obs) => ({
			...obs,
			relevanceScore: computeRelevanceScore(
				obs.lastAccessed,
				obs.accessCount,
				obs.type,
				halfLifeDays,
			),
		}))
		.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Type-to-section header mapping for Layer 1 grouping.
 */
const SECTION_HEADERS: Readonly<Record<string, string>> = Object.freeze({
	decision: "### Key Decisions",
	pattern: "### Patterns",
	error: "### Recent Errors",
	preference: "### Learned Preferences",
	context: "### Context Notes",
	tool_usage: "### Tool Usage Patterns",
});

/** Section display order (most valuable first). */
const SECTION_ORDER = ["decision", "pattern", "error", "preference", "context", "tool_usage"];

/** Max observations per group in Layer 1. */
const MAX_PER_GROUP = 5;

/** Minimum chars remaining to include Layer 2. */
const LAYER_2_THRESHOLD = 500;

/** Minimum chars remaining to include Layer 3. */
const LAYER_3_THRESHOLD = 1000;

/**
 * Options for building memory context.
 */
interface BuildMemoryContextOptions {
	readonly projectName: string;
	readonly lastSessionDate: string | null;
	readonly observations: readonly ScoredObservation[];
	readonly preferences: readonly Preference[];
	readonly tokenBudget?: number;
}

/**
 * Build a markdown memory context string within token budget.
 *
 * Uses 3-layer progressive disclosure:
 * - Layer 1: Summaries grouped by type (always included if budget allows)
 * - Layer 2: Recent Activity timeline (if remaining budget > 500 chars)
 * - Layer 3: Full content for top observations (if remaining budget > 1000 chars)
 */
export function buildMemoryContext(options: BuildMemoryContextOptions): string {
	const {
		projectName,
		lastSessionDate,
		observations,
		preferences,
		tokenBudget = DEFAULT_INJECTION_BUDGET,
	} = options;

	if (observations.length === 0 && preferences.length === 0) return "";

	const charBudget = tokenBudget * CHARS_PER_TOKEN;
	let totalChars = 0;
	const parts: string[] = [];

	// Header
	const header = `## Project Memory (auto-injected)\n**Project:** ${projectName}\n**Last session:** ${lastSessionDate ?? "first session"}\n`;
	if (totalChars + header.length > charBudget) {
		return header.slice(0, charBudget);
	}
	parts.push(header);
	totalChars += header.length;

	// --- Layer 1: Grouped summaries ---
	// Sort by relevance within the function to ensure highest-first in each group
	const sorted = [...observations].sort((a, b) => b.relevanceScore - a.relevanceScore);
	const grouped = groupByType(sorted);

	for (const type of SECTION_ORDER) {
		const group = grouped.get(type);
		if (!group || group.length === 0) continue;

		const sectionHeader = SECTION_HEADERS[type] ?? `### ${type}`;
		const items = group.slice(0, MAX_PER_GROUP);
		const lines = items.map((obs) => `- ${obs.summary} (confidence: ${obs.confidence})`);
		const section = `\n${sectionHeader}\n${lines.join("\n")}\n`;

		if (totalChars + section.length > charBudget) break;
		parts.push(section);
		totalChars += section.length;
	}

	// Preferences section
	if (preferences.length > 0) {
		const prefLines = preferences.map((p) => `- **${p.key}:** ${p.value}`);
		const prefSection = `\n### Preferences\n${prefLines.join("\n")}\n`;

		if (totalChars + prefSection.length <= charBudget) {
			parts.push(prefSection);
			totalChars += prefSection.length;
		}
	}

	// --- Layer 2: Recent Activity timeline (if budget allows) ---
	const remainingAfterL1 = charBudget - totalChars;
	if (remainingAfterL1 > LAYER_2_THRESHOLD && observations.length > 0) {
		const timeline = buildTimeline(observations);
		if (timeline.length > 0) {
			const timelineSection = `\n### Recent Activity\n${timeline}\n`;
			if (totalChars + timelineSection.length <= charBudget) {
				parts.push(timelineSection);
				totalChars += timelineSection.length;
			}
		}
	}

	// --- Layer 3: Full content for top observations (if budget allows) ---
	const remainingAfterL2 = charBudget - totalChars;
	if (remainingAfterL2 > LAYER_3_THRESHOLD && observations.length > 0) {
		const topObs = observations.slice(0, 2);
		const detailLines: string[] = [];
		const headerOverhead = "\n### Details\n\n".length;
		let linesBudget = remainingAfterL2 - headerOverhead;

		for (const obs of topObs) {
			const detail = `**${obs.type}:** ${obs.content}`;
			const cost = detail.length + 1;
			if (cost > linesBudget) break;
			detailLines.push(detail);
			linesBudget -= cost;
		}

		if (detailLines.length > 0) {
			const detailSection = `\n### Details\n${detailLines.join("\n")}\n`;
			if (totalChars + detailSection.length <= charBudget) {
				parts.push(detailSection);
				totalChars += detailSection.length;
			}
		}
	}

	const result = parts.join("");
	// Final safety truncation
	return result.length > charBudget ? result.slice(0, charBudget) : result;
}

/**
 * Group scored observations by type, preserving relevance order within groups.
 */
function groupByType(
	observations: readonly ScoredObservation[],
): ReadonlyMap<string, readonly ScoredObservation[]> {
	const groups = new Map<string, ScoredObservation[]>();

	for (const obs of observations) {
		const existing = groups.get(obs.type);
		if (existing) {
			existing.push(obs);
		} else {
			groups.set(obs.type, [obs]);
		}
	}

	return groups;
}

/**
 * Build a brief timeline of recent sessions from observations.
 */
function buildTimeline(observations: readonly ScoredObservation[]): string {
	// Group by session, take last 5 sessions
	const sessions = new Map<string, { date: string; count: number }>();

	for (const obs of observations) {
		const existing = sessions.get(obs.sessionId);
		if (existing) {
			existing.count++;
			if (new Date(obs.createdAt).getTime() > new Date(existing.date).getTime()) {
				existing.date = obs.createdAt;
			}
		} else {
			sessions.set(obs.sessionId, { date: obs.createdAt, count: 1 });
		}
	}

	const sorted = [...sessions.values()]
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, 5);

	return sorted
		.map((s) => {
			const dateStr = s.date.split("T")[0];
			return `- ${dateStr}: ${s.count} observation${s.count !== 1 ? "s" : ""}`;
		})
		.join("\n");
}

/**
 * Convenience function: retrieve memory context for a project path.
 *
 * Ties together: project lookup, observation retrieval, scoring, preferences, and context building.
 */
export function retrieveMemoryContext(
	projectPath: string,
	tokenBudget?: number,
	db?: Database,
	halfLifeDays?: number,
): string {
	const project = getProjectByPath(projectPath, db);
	if (!project) return "";

	const observations = getObservationsByProject(project.id, 100, db);
	const scored = scoreAndRankObservations(observations, halfLifeDays);
	const preferences = getAllPreferences(db);

	const context = buildMemoryContext({
		projectName: project.name,
		lastSessionDate: project.lastUpdated,
		observations: scored,
		preferences,
		tokenBudget,
	});

	// Batch-update access counts in a single transaction to avoid N+1 writes.
	// Only observations that could plausibly fit in context are updated.
	// Best-effort: failures are swallowed to avoid blocking retrieval.
	const maxInContext = MAX_PER_GROUP * SECTION_ORDER.length;
	const idsToUpdate = scored
		.slice(0, maxInContext)
		.map((obs) => obs.id)
		.filter((id): id is number => id !== undefined);
	if (idsToUpdate.length > 0) {
		try {
			const resolvedDb = db ?? getMemoryDb();
			resolvedDb.run("BEGIN");
			for (const id of idsToUpdate) {
				updateAccessCount(id, db);
			}
			resolvedDb.run("COMMIT");
		} catch {
			// best-effort — access count update is non-critical
		}
	}

	return context;
}
