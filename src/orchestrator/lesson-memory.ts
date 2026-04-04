/**
 * Per-project lesson memory persistence.
 *
 * Stores lessons extracted from pipeline runs in the project kernel,
 * with {projectRoot}/.opencode-autopilot/lesson-memory.json kept as a
 * compatibility mirror/export during the Phase 4 migration window.
 *
 * Memory is pruned on load to remove stale entries (>90 days)
 * and cap at 50 lessons. All writes are atomic (tmp file + rename)
 * to prevent corruption.
 */

import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadLessonMemoryFromKernel, saveLessonMemoryToKernel } from "../kernel/repository";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { getProjectArtifactDir } from "../utils/paths";
import { lessonMemorySchema } from "./lesson-schemas";
import type { LessonMemory } from "./lesson-types";

export type { LessonMemory };

const LESSON_FILE = "lesson-memory.json";
const MAX_LESSONS = 50;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
let legacyLessonMemoryMirrorWarned = false;

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
	const kernelMemory = loadLessonMemoryFromKernel(getProjectArtifactDir(projectRoot));
	if (kernelMemory !== null) {
		return pruneLessons(kernelMemory);
	}

	const memoryPath = join(projectRoot, ".opencode-autopilot", LESSON_FILE);
	try {
		const raw = await readFile(memoryPath, "utf-8");
		const parsed = JSON.parse(raw);
		// Prune before schema validation so files with >50 lessons
		// (manual edit, older version) are capped rather than rejected
		const pruned = pruneLessons({
			...parsed,
			lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
		});
		const validated = lessonMemorySchema.parse(pruned);
		saveLessonMemoryToKernel(getProjectArtifactDir(projectRoot), validated);
		return validated;
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
	saveLessonMemoryToKernel(getProjectArtifactDir(projectRoot), validated);

	try {
		const dir = join(projectRoot, ".opencode-autopilot");
		await ensureDir(dir);
		const memoryPath = join(dir, LESSON_FILE);
		const tmpPath = `${memoryPath}.tmp.${randomBytes(8).toString("hex")}`;
		await writeFile(tmpPath, JSON.stringify(validated, null, 2), "utf-8");
		await rename(tmpPath, memoryPath);
	} catch (error: unknown) {
		if (!legacyLessonMemoryMirrorWarned) {
			legacyLessonMemoryMirrorWarned = true;
			console.warn("[opencode-autopilot] lesson-memory.json mirror write failed:", error);
		}
	}
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
		lessons: Object.freeze(capped) as unknown as typeof memory.lessons,
	});
}
