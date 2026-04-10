/**
 * Provenance-first memory retrieval.
 *
 * V2 retrieval uses the new `memories` table (tool-curated, AI-extracted).
 * V1 retrieval (legacy) uses observations/preferences/lessons tables.
 *
 * Both are exported. The injector switches to V2 when memories exist,
 * falling back to V1 for backward compatibility.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { getLogger } from "../logging/domains";
import {
	CHARS_PER_TOKEN,
	DEFAULT_INJECTION_BUDGET,
	KIND_WEIGHTS,
	type MEMORY_KINDS,
} from "./constants";
import { getMemoryDb } from "./database";
import { computeRelevanceScore } from "./decay";
import { getActiveMemories } from "./memories";
import {
	getConfirmedPreferencesForProject,
	getProjectByPath,
	getRecentFailureObservations,
	listRelevantLessons,
	updateAccessCount,
} from "./repository";
import type { Memory, Observation, Preference } from "./types";

const logger = getLogger("memory", "retrieval");

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
		} catch (err) {
			// best-effort — access count update is non-critical
			logger.warn("access count update failed", { error: String(err) });
		}
	}

	return context;
}

// ---------------------------------------------------------------------------
// V2 retrieval — memories table
// ---------------------------------------------------------------------------

const MEMORY_INSTRUCTIONS_BLOCK = `
### Memory Instructions
You may save new memories using \`oc_memory_save\` when:
- The user states a preference or correction
- A decision is made about architecture, tooling, or workflow
- You discover a project fact (tech stack, conventions, structure)
- A mistake is identified that should be avoided in future
- The user establishes a workflow rule ("always do X before Y")
- The user explicitly says "remember this" or similar
Do NOT save trivial or transient information.
`.trim();

type MemoryKindKey = (typeof MEMORY_KINDS)[number];

const KIND_DISPLAY_ORDER: readonly MemoryKindKey[] = [
	"mistake",
	"workflow_rule",
	"decision",
	"preference",
	"project_fact",
] as const;

const KIND_LABELS: Readonly<Record<MemoryKindKey, string>> = {
	preference: "Preferences",
	decision: "Decisions",
	project_fact: "Project Facts",
	mistake: "Mistakes to Avoid",
	workflow_rule: "Workflow Rules",
};

function sortMemoriesByWeight(memories: readonly Memory[]): readonly Memory[] {
	return [...memories].sort((a, b) => {
		const wa = KIND_WEIGHTS[a.kind as MemoryKindKey] ?? 1;
		const wb = KIND_WEIGHTS[b.kind as MemoryKindKey] ?? 1;
		if (wb !== wa) return wb - wa;
		return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
	});
}

function groupByKind(memories: readonly Memory[]): ReadonlyMap<MemoryKindKey, readonly Memory[]> {
	const map = new Map<MemoryKindKey, Memory[]>();
	for (const mem of memories) {
		const kind = mem.kind as MemoryKindKey;
		const existing = map.get(kind);
		if (existing) {
			existing.push(mem);
		} else {
			map.set(kind, [mem]);
		}
	}
	return map;
}

interface BuildMemoryContextV2Options {
	readonly projectName: string;
	readonly lastSessionDate: string | null;
	readonly projectMemories: readonly Memory[];
	readonly userMemories: readonly Memory[];
	readonly tokenBudget?: number;
	readonly groupByTopicGroup?: boolean;
}

export function buildMemoryContextV2(options: BuildMemoryContextV2Options): string {
	const {
		projectName,
		lastSessionDate,
		projectMemories,
		userMemories,
		tokenBudget = DEFAULT_INJECTION_BUDGET,
		groupByTopicGroup = false,
	} = options;

	const allMemories = [...projectMemories, ...userMemories];
	if (allMemories.length === 0) {
		return MEMORY_INSTRUCTIONS_BLOCK;
	}

	const charBudget = tokenBudget * CHARS_PER_TOKEN;
	let totalChars = 0;
	const parts: string[] = [];

	const header = `## Memory (auto-injected)\n**Project:** ${projectName}\n**Last session:** ${lastSessionDate ?? "first session"}\n`;
	if (header.length > charBudget) {
		return MEMORY_INSTRUCTIONS_BLOCK;
	}
	parts.push(header);
	totalChars += header.length;

	const sorted = sortMemoriesByWeight(allMemories);
	const grouped = groupByKind(sorted);

	for (const kind of KIND_DISPLAY_ORDER) {
		const mems = grouped.get(kind);
		if (!mems || mems.length === 0) continue;

		const label = KIND_LABELS[kind];
		let section = `\n### ${label}\n`;

		if (groupByTopicGroup) {
			const byTopicGroup = new Map<string | null, Memory[]>();
			for (const mem of mems) {
				const key = mem.topicGroup ?? null;
				const existing = byTopicGroup.get(key);
				if (existing) {
					existing.push(mem);
				} else {
					byTopicGroup.set(key, [mem]);
				}
			}

			for (const [topicGroup, topicGroupMemories] of byTopicGroup) {
				if (topicGroup !== null) {
					section += `\n**${topicGroup}**\n`;
				}
				for (const mem of topicGroupMemories) {
					const scope = mem.scope === "user" ? " _(user-wide)_" : "";
					const topicSuffix = mem.topic && topicGroup !== null ? ` [${mem.topic}]` : "";
					const line = `- ${mem.summary}${topicSuffix}${scope}\n`;
					section += line;
				}
			}
		} else {
			for (const mem of mems) {
				const scope = mem.scope === "user" ? " _(user-wide)_" : "";
				const line = `- ${mem.summary}${scope}\n`;
				section += line;
			}
		}

		if (totalChars + section.length > charBudget) break;
		parts.push(section);
		totalChars += section.length;
	}

	const instrLen = MEMORY_INSTRUCTIONS_BLOCK.length + 2;
	if (totalChars + instrLen <= charBudget) {
		parts.push(`\n${MEMORY_INSTRUCTIONS_BLOCK}\n`);
	}

	const result = parts.join("");
	return result.length > charBudget ? result.slice(0, charBudget) : result;
}

function bumpAccessCounts(memories: readonly Memory[], db: Database): void {
	if (memories.length === 0) return;
	try {
		const now = new Date().toISOString();
		db.run("BEGIN");
		const stmt = db.prepare(
			"UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?",
		);
		for (const mem of memories) {
			if (mem.id !== undefined) {
				stmt.run(now, mem.id);
			}
		}
		db.run("COMMIT");
	} catch (err) {
		logger.warn("V2 access count update failed", { error: String(err) });
		try {
			db.run("ROLLBACK");
		} catch {
			// ignore rollback failure
		}
	}
}

export function retrieveMemoryContextV2(
	projectPath: string,
	tokenBudget?: number,
	db?: Database,
): string {
	const resolvedDb = db ?? getMemoryDb();
	const project = getProjectByPath(projectPath, resolvedDb);
	const projectId = project?.id ?? null;
	const projectName = project?.name ?? projectPath.split("/").pop() ?? "unknown";
	const lastSessionDate = project?.lastUpdated ?? null;

	const projectMemories = getActiveMemories(projectId, 50, resolvedDb);
	const userMemories = projectId !== null ? getActiveMemories(null, 50, resolvedDb) : [];
	const allMemories = [...projectMemories, ...userMemories];

	const context = buildMemoryContextV2({
		projectName,
		lastSessionDate,
		projectMemories,
		userMemories,
		tokenBudget,
	});

	bumpAccessCounts(allMemories, resolvedDb);

	return context;
}
