/**
 * oc_logs tool - Session log dashboard.
 *
 * Provides three modes:
 * - "list": List all session logs with summary info
 * - "detail": View full session log with markdown summary
 * - "search": Filter events by type and time range
 *
 * Follows the *Core + tool() wrapper pattern per CLAUDE.md.
 * Returns JSON with displayText field following oc_doctor pattern.
 *
 * @module
 */

import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import {
	listSessionLogs,
	readLatestSessionLog,
	readSessionLog,
	searchEvents,
} from "../observability/log-reader";
import { generateSessionSummary } from "../observability/summary-generator";

/**
 * Options for logsCore search/detail modes.
 */
interface LogsOptions {
	readonly sessionID?: string;
	readonly eventType?: string;
	readonly after?: string;
	readonly before?: string;
}

/**
 * Formats a session list as a human-readable table.
 */
function formatSessionTable(
	sessions: readonly {
		readonly sessionId: string;
		readonly startedAt: string;
		readonly endedAt: string | null;
		readonly eventCount: number;
		readonly decisionCount: number;
		readonly errorCount: number;
	}[],
): string {
	if (sessions.length === 0) {
		return "No session logs found.";
	}

	const lines = [
		"Session Logs",
		"",
		"| Session ID | Started | Events | Decisions | Errors |",
		"|------------|---------|--------|-----------|--------|",
	];

	for (const s of sessions) {
		const started = s.startedAt.replace("T", " ").replace(/\.\d+Z$/, "Z");
		lines.push(
			`| ${s.sessionId} | ${started} | ${s.eventCount} | ${s.decisionCount} | ${s.errorCount} |`,
		);
	}

	lines.push("", `${sessions.length} session(s) total`);
	return lines.join("\n");
}

/**
 * Core function for the oc_logs tool.
 *
 * @param mode - "list", "detail", or "search"
 * @param options - Optional filters (sessionID, eventType, after, before)
 * @param logsDir - Optional override for logs directory (for testing)
 */
export async function logsCore(
	mode: "list" | "detail" | "search",
	options?: LogsOptions,
	logsDir?: string,
): Promise<string> {
	switch (mode) {
		case "list": {
			const sessions = await listSessionLogs(logsDir);

			return JSON.stringify({
				action: "logs_list",
				sessions,
				displayText: formatSessionTable(sessions),
			});
		}

		case "detail": {
			const log = options?.sessionID
				? await readSessionLog(options.sessionID, logsDir)
				: await readLatestSessionLog(logsDir);

			if (!log) {
				const target = options?.sessionID
					? `Session "${options.sessionID}" not found.`
					: "No session logs found.";
				return JSON.stringify({
					action: "error",
					message: target,
				});
			}

			const summary = generateSessionSummary(log);

			return JSON.stringify({
				action: "logs_detail",
				sessionLog: log,
				summary,
				displayText: summary,
			});
		}

		case "search": {
			const log = options?.sessionID
				? await readSessionLog(options.sessionID, logsDir)
				: await readLatestSessionLog(logsDir);

			if (!log) {
				const target = options?.sessionID
					? `Session "${options.sessionID}" not found.`
					: "No session logs found.";
				return JSON.stringify({
					action: "error",
					message: target,
				});
			}

			const filtered = searchEvents(log.events, {
				type: options?.eventType,
				after: options?.after,
				before: options?.before,
			});

			const displayLines = [
				`Search Results (${filtered.length} event(s))`,
				"",
				...filtered.map((e) => `[${e.timestamp}] ${e.type}: ${JSON.stringify(e)}`),
			];

			return JSON.stringify({
				action: "logs_search",
				sessionId: log.sessionId,
				events: filtered,
				displayText: displayLines.join("\n"),
			});
		}
	}
}

// --- Tool wrapper ---

export const ocLogs = tool({
	description:
		"View session logs. Modes: 'list' shows all sessions, 'detail' shows full log with " +
		"summary, 'search' filters events by type/time. Use to inspect session history and errors.",
	args: {
		mode: z.enum(["list", "detail", "search"]).describe("View mode: list, detail, or search"),
		sessionID: z.string().optional().describe("Session ID to view (uses latest if omitted)"),
		eventType: z.string().optional().describe("Filter events by type (for search mode)"),
		after: z.string().optional().describe("Only events after this ISO timestamp (for search mode)"),
		before: z
			.string()
			.optional()
			.describe("Only events before this ISO timestamp (for search mode)"),
	},
	async execute({ mode, sessionID, eventType, after, before }) {
		return logsCore(mode, { sessionID, eventType, after, before });
	},
});
