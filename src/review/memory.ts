/**
 * Per-project review memory persistence.
 *
 * Stores recent findings and false positives at
 * {projectRoot}/.opencode-assets/review-memory.json
 *
 * Memory is pruned on load to cap storage and remove stale entries.
 * All writes are atomic (tmp file + rename) to prevent corruption.
 */

import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { reviewMemorySchema } from "./schemas";
import type { ReviewMemory } from "./types";

export type { ReviewMemory };

const MEMORY_FILE = "review-memory.json";
const MAX_FINDINGS = 100;
const MAX_FALSE_POSITIVES = 50;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Create a valid empty memory object.
 */
export function createEmptyMemory(): ReviewMemory {
	return reviewMemorySchema.parse({
		schemaVersion: 1,
		projectProfile: { stacks: [], lastDetectedAt: "" },
		recentFindings: [],
		falsePositives: [],
		lastReviewedAt: null,
	});
}

/**
 * Load review memory from disk.
 * Returns null if file doesn't exist (first run).
 * Returns null on malformed JSON (SyntaxError) or invalid schema (ZodError)
 * to allow recovery rather than crashing the pipeline.
 * Prunes on load to cap storage.
 */
export async function loadReviewMemory(projectRoot: string): Promise<ReviewMemory | null> {
	const memoryPath = join(projectRoot, ".opencode-assets", MEMORY_FILE);
	try {
		const raw = await readFile(memoryPath, "utf-8");
		const parsed = JSON.parse(raw);
		const validated = reviewMemorySchema.parse(parsed);
		return pruneMemory(validated);
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
 * Save review memory to disk with atomic write.
 * Validates through schema before writing (bidirectional validation).
 * Uses tmp file + rename to prevent corruption.
 */
export async function saveReviewMemory(memory: ReviewMemory, projectRoot: string): Promise<void> {
	const validated = reviewMemorySchema.parse(memory);
	const dir = join(projectRoot, ".opencode-assets");
	await ensureDir(dir);
	const memoryPath = join(dir, MEMORY_FILE);
	const tmpPath = `${memoryPath}.tmp.${Date.now()}`;
	await writeFile(tmpPath, JSON.stringify(validated, null, 2), "utf-8");
	await rename(tmpPath, memoryPath);
}

/**
 * Prune memory to cap storage and remove stale entries.
 * Pure function -- returns new frozen object, never mutates.
 *
 * - recentFindings: cap at 100 (keep newest -- later entries are newer)
 * - falsePositives: cap at 50 (keep newest by markedAt date)
 * - falsePositives: remove entries older than 30 days
 */
export function pruneMemory(memory: ReviewMemory): ReviewMemory {
	const now = Date.now();

	// Prune false positives older than 30 days first, then cap
	const freshFalsePositives = memory.falsePositives.filter(
		(fp) => now - new Date(fp.markedAt).getTime() < THIRTY_DAYS_MS,
	);

	// Sort by markedAt descending (newest first) then take the first MAX
	const sortedFP = [...freshFalsePositives].sort(
		(a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime(),
	);
	const cappedFP = sortedFP.slice(0, MAX_FALSE_POSITIVES);

	// Cap recentFindings (later entries are newer, keep the tail)
	const cappedFindings =
		memory.recentFindings.length > MAX_FINDINGS
			? memory.recentFindings.slice(memory.recentFindings.length - MAX_FINDINGS)
			: [...memory.recentFindings];

	return Object.freeze({
		...memory,
		recentFindings: [...cappedFindings],
		falsePositives: [...cappedFP],
	});
}
