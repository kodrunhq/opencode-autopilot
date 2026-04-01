/**
 * Per-project lesson memory persistence.
 *
 * Stores lessons extracted from pipeline runs at
 * {projectRoot}/.opencode-assets/lesson-memory.json
 *
 * Memory is pruned on load to remove stale entries (>90 days)
 * and cap at 50 lessons. All writes are atomic (tmp file + rename)
 * to prevent corruption.
 */

import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { lessonMemorySchema } from "./lesson-schemas";
import type { LessonMemory } from "./lesson-types";

export type { LessonMemory };

const LESSON_FILE = "lesson-memory.json";
const MAX_LESSONS = 50;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Create a valid empty lesson memory object.
 */
export function createEmptyLessonMemory(): LessonMemory {
	return lessonMemorySchema.parse({
		schemaVersion: 1,
		lessons: [],
		lastUpdatedAt: null,
	});
}

/**
 * Load lesson memory from disk.
 * Returns null if file doesn't exist (first run).
 * Returns null on malformed JSON (SyntaxError) or invalid schema (ZodError)
 * to allow recovery rather than crashing the pipeline.
 * Prunes on load to remove stale entries and cap storage.
 */
export async function loadLessonMemory(projectRoot: string): Promise<LessonMemory | null> {
	const memoryPath = join(projectRoot, ".opencode-assets", LESSON_FILE);
	try {
		const raw = await readFile(memoryPath, "utf-8");
		const parsed = JSON.parse(raw);
		const validated = lessonMemorySchema.parse(parsed);
		return pruneLessons(validated);
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return null;
		}
		// Recover from malformed JSON or schema violations instead of crashing
		if (
			error instanceof SyntaxError ||
			(error !== null && typeof error === "object" && "issues" in error)
		) {
			return null;
		}
		throw error;
	}
}

/**
 * Save lesson memory to disk with atomic write.
 * Validates through schema before writing (bidirectional validation).
 * Uses tmp file + rename to prevent corruption.
 */
export async function saveLessonMemory(memory: LessonMemory, projectRoot: string): Promise<void> {
	const validated = lessonMemorySchema.parse(memory);
	const dir = join(projectRoot, ".opencode-assets");
	await ensureDir(dir);
	const memoryPath = join(dir, LESSON_FILE);
	const tmpPath = `${memoryPath}.tmp.${Date.now()}`;
	await writeFile(tmpPath, JSON.stringify(validated, null, 2), "utf-8");
	await rename(tmpPath, memoryPath);
}

/**
 * Prune lesson memory to remove stale entries and cap storage.
 * Pure function -- returns new frozen object, never mutates.
 *
 * - Remove lessons older than 90 days
 * - Sort remaining by extractedAt descending (newest first)
 * - Cap at 50 lessons
 */
export function pruneLessons(memory: LessonMemory): LessonMemory {
	const now = Date.now();

	// Filter out stale lessons (>90 days)
	const fresh = memory.lessons.filter(
		(lesson) => now - new Date(lesson.extractedAt).getTime() < NINETY_DAYS_MS,
	);

	// Sort by extractedAt descending (newest first) then cap
	const sorted = [...fresh].sort(
		(a, b) => new Date(b.extractedAt).getTime() - new Date(a.extractedAt).getTime(),
	);
	const capped = sorted.slice(0, MAX_LESSONS);

	return Object.freeze({
		...memory,
		lessons: Object.freeze(capped),
	});
}
