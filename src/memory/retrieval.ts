/**
 * Provenance-first memory retrieval.
 *
 * Injects bounded memory context from explicit, inspectable sources:
 * - confirmed project and global preferences
 * - recent project lessons
 * - recent failure-avoidance notes from error observations
 *
 * Generic observations remain queryable for inspection, but are no longer the
 * primary injected memory contract.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { CHARS_PER_TOKEN, DEFAULT_INJECTION_BUDGET } from "./constants";
import { getMemoryDb } from "./database";
import { computeRelevanceScore } from "./decay";
import {
	getConfirmedPreferencesForProject,
	getProjectByPath,
	getRecentFailureObservations,
	listRelevantLessons,
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

interface BuildMemoryContextOptions {
	readonly projectName: string;
	readonly lastSessionDate: string | null;
	readonly preferences: readonly Preference[];
	readonly lessons: readonly {
		readonly content: string;
		readonly domain: string;
		readonly extractedAt: string;
		readonly sourcePhase: string;
	}[];
	readonly recentFailures: readonly ScoredObservation[];
	readonly tokenBudget?: number;
}

function appendSection(
	parts: string[],
	totalChars: number,
	charBudget: number,
	section: string,
): number {
	if (totalChars + section.length > charBudget) {
		return totalChars;
	}
	parts.push(section);
	return totalChars + section.length;
}

/**
 * Build a markdown memory context string within token budget.
 */
export function buildMemoryContext(options: BuildMemoryContextOptions): string {
	const {
		projectName,
		lastSessionDate,
		preferences,
		lessons,
		recentFailures,
		tokenBudget = DEFAULT_INJECTION_BUDGET,
	} = options;

	if (preferences.length === 0 && lessons.length === 0 && recentFailures.length === 0) {
		return "";
	}

	const charBudget = tokenBudget * CHARS_PER_TOKEN;
	let totalChars = 0;
	const parts: string[] = [];

	const header = `## Project Memory (auto-injected)\n**Project:** ${projectName}\n**Last session:** ${lastSessionDate ?? "first session"}\n`;
	if (header.length > charBudget) {
		return header.slice(0, charBudget);
	}
	parts.push(header);
	totalChars += header.length;

	if (preferences.length > 0) {
		const projectPreferences = preferences.filter((preference) => preference.scope === "project");
		const globalPreferences = preferences.filter((preference) => preference.scope === "global");

		if (projectPreferences.length > 0) {
			const section = `\n### Confirmed Project Preferences\n${projectPreferences
				.map(
					(preference) =>
						`- **${preference.key}:** ${preference.value} (confidence: ${preference.confidence}, evidence: ${preference.evidenceCount})`,
				)
				.join("\n")}\n`;
			totalChars = appendSection(parts, totalChars, charBudget, section);
		}

		if (globalPreferences.length > 0) {
			const section = `\n### Confirmed User Preferences\n${globalPreferences
				.map(
					(preference) =>
						`- **${preference.key}:** ${preference.value} (confidence: ${preference.confidence}, evidence: ${preference.evidenceCount})`,
				)
				.join("\n")}\n`;
			totalChars = appendSection(parts, totalChars, charBudget, section);
		}
	}

	if (lessons.length > 0) {
		const section = `\n### Recent Lessons\n${lessons
			.map(
				(lesson) =>
					`- ${lesson.content} (${lesson.domain}, ${lesson.sourcePhase.toLowerCase()}, ${lesson.extractedAt.split("T")[0]})`,
			)
			.join("\n")}\n`;
		totalChars = appendSection(parts, totalChars, charBudget, section);
	}

	if (recentFailures.length > 0) {
		const sortedFailures = [...recentFailures].sort((a, b) => b.relevanceScore - a.relevanceScore);
		const section = `\n### Failure Avoidance Notes\n${sortedFailures
			.map(
				(observation) =>
					`- ${observation.summary} (confidence: ${observation.confidence}, ${observation.createdAt.split("T")[0]})`,
			)
			.join("\n")}\n`;
		totalChars = appendSection(parts, totalChars, charBudget, section);
	}

	const result = parts.join("");
	return result.length > charBudget ? result.slice(0, charBudget) : result;
}

/**
 * Convenience function: retrieve memory context for a project path.
 */
export function retrieveMemoryContext(
	projectPath: string,
	tokenBudget?: number,
	db?: Database,
	halfLifeDays?: number,
): string {
	const project = getProjectByPath(projectPath, db);
	if (!project) return "";

	const preferences = getConfirmedPreferencesForProject(project.id, db);
	const lessons = listRelevantLessons(project.id, 5, db);
	const failures = scoreAndRankObservations(
		getRecentFailureObservations(project.id, 5, db),
		halfLifeDays,
	);

	const context = buildMemoryContext({
		projectName: project.name,
		lastSessionDate: project.lastUpdated,
		preferences,
		lessons,
		recentFailures: failures,
		tokenBudget,
	});

	const idsToUpdate = failures
		.map((observation) => observation.id)
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
