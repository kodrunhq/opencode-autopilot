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

interface LogsOptions {
	readonly sessionID?: string;
	readonly eventType?: string;
	readonly after?: string;
	readonly before?: string;
	readonly domain?: string;
	readonly subsystem?: string;
	readonly severity?: string;
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
	const logsRoot = logsDir ?? process.cwd();
	switch (mode) {
		case "list": {
			const sessions = await listSessionLogs(logsRoot);

			return JSON.stringify({
				action: "logs_list",
				sessions,
				displayText: formatSessionTable(sessions),
			});
		}

		case "detail": {
			const log = options?.sessionID
				? await readSessionLog(options.sessionID, logsRoot)
				: await readLatestSessionLog(logsRoot);

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
				? await readSessionLog(options.sessionID, logsRoot)
				: await readLatestSessionLog(logsRoot);

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
				domain: options?.domain,
				subsystem: options?.subsystem,
				severity: options?.severity,
			});

			const displayLines = [
				`Search Results (${filtered.length} event(s))`,
				"",
				...filtered.map((e) => `[${e.timestamp}] ${e.type}: ${JSON.stringify(e)}`),
			];

			return JSON.stringify({
				action: "logs_search",
				sessionId: log.sessionId,
				filters: {
					eventType: options?.eventType,
					after: options?.after,
					before: options?.before,
					domain: options?.domain,
					subsystem: options?.subsystem,
					severity: options?.severity,
				},
				matchCount: filtered.length,
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
		"summary, 'search' filters events by type/time/domain/subsystem/severity. Use to inspect session history and errors.",
	args: {
		mode: z.enum(["list", "detail", "search"]).describe("View mode: list, detail, or search"),
		sessionID: z
			.string()
			.regex(/^[a-zA-Z0-9_-]{1,256}$/)
			.optional()
			.describe("Session ID to view (uses latest if omitted)"),
		eventType: z.string().optional().describe("Filter events by type (for search mode)"),
		after: z.string().optional().describe("Only events after this ISO timestamp (for search mode)"),
		before: z
			.string()
			.optional()
			.describe("Only events before this ISO timestamp (for search mode)"),
		domain: z
			.string()
			.optional()
			.describe("Filter events by domain (e.g. 'session', 'orchestrator') (for search mode)"),
		subsystem: z
			.string()
			.optional()
			.describe("Filter events by payload.subsystem field (for search mode)"),
		severity: z
			.string()
			.optional()
			.describe(
				"Filter by severity: matches event.type (e.g. 'error', 'warning') or payload.severity/payload.level (for search mode)",
			),
	},
	async execute({ mode, sessionID, eventType, after, before, domain, subsystem, severity }) {
		return logsCore(mode, { sessionID, eventType, after, before, domain, subsystem, severity });
	},
});
