import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { getGlobalConfigDir } from "../utils/paths";
import { sessionEventSchema } from "./schemas";
import type { SessionEvent } from "./types";

/**
 * Returns the global logs directory path.
 * Logs are user-scoped, not project-scoped (D-08, D-09).
 */
export function getLogsDir(): string {
	return join(getGlobalConfigDir(), "logs");
}

/**
 * Returns the JSONL log file path for a given session ID.
 */
function getSessionLogPath(sessionId: string, logsDir?: string): string {
	return join(logsDir ?? getLogsDir(), `${sessionId}.jsonl`);
}

/**
 * Logs a structured event to the session's JSONL log file.
 * Validates the event against the Zod schema before writing.
 * Creates the logs directory if it does not exist.
 *
 * @param event - The session event to log (D-02, D-04-D-07)
 * @param logsDir - Optional override for the logs directory (for testing)
 */
export async function logEvent(event: SessionEvent, logsDir?: string): Promise<void> {
	// Validate against schema -- throws on invalid events
	const validated = sessionEventSchema.parse(event);

	const dir = logsDir ?? getLogsDir();
	await ensureDir(dir);

	const logPath = getSessionLogPath(validated.sessionId, dir);
	const line = `${JSON.stringify(validated)}\n`;

	await appendFile(logPath, line, "utf-8");
}

/**
 * Reads and parses all events from a session's JSONL log file.
 * Returns an empty array if the session log does not exist.
 *
 * @param sessionId - The session ID to read logs for
 * @param logsDir - Optional override for the logs directory (for testing)
 */
export async function getSessionLog(sessionId: string, logsDir?: string): Promise<SessionEvent[]> {
	const logPath = getSessionLogPath(sessionId, logsDir);

	try {
		const content = await readFile(logPath, "utf-8");
		const lines = content.trim().split("\n").filter(Boolean);

		return lines.map((line) => sessionEventSchema.parse(JSON.parse(line)));
	} catch (error: unknown) {
		if (isEnoentError(error)) return [];
		throw error;
	}
}
