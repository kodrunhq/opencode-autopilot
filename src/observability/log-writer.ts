/**
 * Session log persistence layer.
 *
 * Writes complete session logs as JSON files with atomic write pattern
 * (temp file + rename) to prevent corruption. Logs are stored in
 * ~/.config/opencode/logs/ (user-scoped, not project-scoped per D-08, D-09).
 */

import { randomBytes } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir } from "../utils/fs-helpers";
import { getGlobalConfigDir } from "../utils/paths";
import { sessionLogSchema } from "./schemas";
import type { SessionEvent, SessionLog } from "./types";

/**
 * Returns the global logs directory path.
 * Logs are user-scoped, not project-scoped (D-08, D-09).
 */
export function getLogsDir(): string {
	return join(getGlobalConfigDir(), "logs");
}

/**
 * Input shape for writeSessionLog -- the in-memory data to persist.
 */
interface WriteSessionInput {
	readonly sessionId: string;
	readonly startedAt: string;
	readonly events: readonly SessionEvent[];
}

/**
 * Converts in-memory session events to the persisted SessionLog format.
 *
 * Extracts decisions from decision-type events.
 * Builds errorSummary by counting error events by errorType.
 */
export function convertToSessionLog(input: WriteSessionInput): SessionLog {
	const decisions = input.events
		.filter((e): e is SessionEvent & { type: "decision" } => e.type === "decision")
		.map((e) => ({
			timestamp: e.timestamp,
			phase: e.phase,
			agent: e.agent,
			decision: e.decision,
			rationale: e.rationale,
		}));

	const errorSummary: Record<string, number> = {};
	for (const e of input.events) {
		if (e.type === "error") {
			errorSummary[e.errorType] = (errorSummary[e.errorType] ?? 0) + 1;
		}
	}

	return {
		schemaVersion: 1 as const,
		sessionId: input.sessionId,
		startedAt: input.startedAt,
		endedAt: new Date().toISOString(),
		events: [...input.events],
		decisions,
		errorSummary,
	};
}

/**
 * Persists a session log to disk as a JSON file.
 *
 * Uses atomic write pattern: write to temp file, then rename.
 * Validates through sessionLogSchema before writing (defensive).
 * Creates the logs directory if it does not exist.
 *
 * @param input - Session data to persist
 * @param logsDir - Optional override for logs directory (for testing)
 */
export async function writeSessionLog(input: WriteSessionInput, logsDir?: string): Promise<void> {
	const log = convertToSessionLog(input);

	// Validate before writing (bidirectional validation)
	sessionLogSchema.parse(log);

	const dir = logsDir ?? getLogsDir();
	await ensureDir(dir);

	const finalPath = join(dir, `${log.sessionId}.json`);
	const tmpPath = `${finalPath}.tmp.${randomBytes(8).toString("hex")}`;

	await writeFile(tmpPath, JSON.stringify(log, null, 2), "utf-8");
	await rename(tmpPath, finalPath);
}
