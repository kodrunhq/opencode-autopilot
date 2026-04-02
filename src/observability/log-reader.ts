/**
 * Session log reading, listing, searching, and filtering.
 *
 * Provides query capabilities over persisted session logs:
 * - Read a specific session by ID
 * - List all sessions sorted by startedAt (newest first)
 * - Read the most recent session
 * - Search/filter events within a session by type and time range
 *
 * All functions handle missing directories gracefully (D-16).
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { isEnoentError } from "../utils/fs-helpers";
import { getLogsDir } from "./log-writer";
import { sessionLogSchema } from "./schemas";
import type { SessionEvent, SessionLog } from "./types";

/**
 * Summary entry for session listing (lightweight, no full event data).
 */
export interface SessionLogEntry {
	readonly sessionId: string;
	readonly startedAt: string;
	readonly endedAt: string | null;
	readonly eventCount: number;
	readonly decisionCount: number;
	readonly errorCount: number;
}

/**
 * Filters for searching events within a session log.
 */
export interface EventSearchFilters {
	readonly type?: string;
	readonly after?: string;
	readonly before?: string;
}

/**
 * Reads and parses a specific session log by ID.
 *
 * Returns null on: non-existent file, malformed JSON, invalid schema.
 * Never throws for expected failure modes.
 */
export async function readSessionLog(
	sessionId: string,
	logsDir?: string,
): Promise<SessionLog | null> {
	const dir = logsDir ?? getLogsDir();
	const logPath = join(dir, `${sessionId}.json`);

	try {
		const content = await readFile(logPath, "utf-8");
		const parsed = JSON.parse(content);
		const result = sessionLogSchema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch (error: unknown) {
		if (isEnoentError(error)) return null;
		// Recover from malformed JSON
		if (error instanceof SyntaxError) return null;
		throw error;
	}
}

/**
 * Lists all session logs sorted by startedAt descending (newest first).
 *
 * Returns a lightweight SessionLogEntry for each log (no full event data).
 * Skips non-JSON files and malformed logs.
 * Returns empty array for missing or empty directories.
 */
export async function listSessionLogs(logsDir?: string): Promise<readonly SessionLogEntry[]> {
	const dir = logsDir ?? getLogsDir();

	let files: string[];
	try {
		files = await readdir(dir);
	} catch (error: unknown) {
		if (isEnoentError(error)) return [];
		throw error;
	}

	const jsonFiles = files.filter((f) => f.endsWith(".json"));
	const entries: SessionLogEntry[] = [];

	for (const file of jsonFiles) {
		try {
			const content = await readFile(join(dir, file), "utf-8");
			const parsed = JSON.parse(content);
			const result = sessionLogSchema.safeParse(parsed);

			if (result.success) {
				const log = result.data;
				const errorCount = log.events.filter((e) => e.type === "error").length;

				entries.push({
					sessionId: log.sessionId,
					startedAt: log.startedAt,
					endedAt: log.endedAt,
					eventCount: log.events.length,
					decisionCount: log.decisions.length,
					errorCount,
				});
			}
		} catch {
			// Skip malformed files
		}
	}

	// Sort by startedAt descending (newest first)
	entries.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

	return entries;
}

/**
 * Returns the most recent session log (by startedAt).
 *
 * Returns null when no valid logs exist.
 */
export async function readLatestSessionLog(logsDir?: string): Promise<SessionLog | null> {
	const entries = await listSessionLogs(logsDir);

	if (entries.length === 0) return null;

	// Entries are already sorted newest-first
	return readSessionLog(entries[0].sessionId, logsDir);
}

/**
 * Filters events by type and/or time range.
 *
 * Pure function (no I/O, no side effects).
 * Accepts a readonly array of events and returns a filtered copy.
 */
export function searchEvents(
	events: readonly SessionEvent[],
	filters: EventSearchFilters,
): readonly SessionEvent[] {
	return events.filter((event) => {
		if (filters.type && event.type !== filters.type) return false;
		if (filters.after && event.timestamp <= filters.after) return false;
		if (filters.before && event.timestamp >= filters.before) return false;
		return true;
	});
}
