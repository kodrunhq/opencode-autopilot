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
import { openProjectKernelDb } from "../kernel/database";
import {
	listSessionLogs,
	readLatestSessionLog,
	readSessionLog,
	type SessionLog,
	searchEvents,
} from "../observability/log-reader";
import { generateSessionSummary } from "../observability/summary-generator";
import { pipelineStateSchema } from "../orchestrator/schemas";
import { collectPendingDispatchSessionIds } from "../orchestrator/session-correlation";
import { getProjectRootFromArtifactDir } from "../utils/paths";

interface LogsOptions {
	readonly sessionID?: string;
	readonly runId?: string;
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

	for (const session of sessions) {
		const started = session.startedAt.replace("T", " ").replace(/\.\d+Z$/, "Z");
		lines.push(
			`| ${session.sessionId} | ${started} | ${session.eventCount} | ${session.decisionCount} | ${session.errorCount} |`,
		);
	}

	lines.push("", `${sessions.length} session(s) total`);
	return lines.join("\n");
}

async function readLogsForRun(
	runId: string,
	artifactDirOrProjectRoot: string,
): Promise<readonly SessionLog[]> {
	const projectRoot = getProjectRootFromArtifactDir(artifactDirOrProjectRoot);
	const db = openProjectKernelDb(projectRoot);

	try {
		const row = db
			.query(
				"SELECT state_json FROM pipeline_runs WHERE run_id = ? ORDER BY state_revision DESC LIMIT 1",
			)
			.get(runId) as { readonly state_json: string } | null;
		if (!row) {
			return Object.freeze([]);
		}

		const parsed = pipelineStateSchema.safeParse(JSON.parse(row.state_json));
		if (!parsed.success) {
			return Object.freeze([]);
		}

		const sessionIds = collectPendingDispatchSessionIds(parsed.data.pendingDispatches);
		const logs = await Promise.all(
			sessionIds.map((sessionId) => readSessionLog(sessionId, artifactDirOrProjectRoot)),
		);

		return Object.freeze(logs.filter((log): log is SessionLog => log !== null));
	} catch {
		return Object.freeze([]);
	} finally {
		db.close();
	}
}

async function resolveSessionLogs(
	options: LogsOptions | undefined,
	logsRoot: string,
): Promise<readonly SessionLog[]> {
	if (options?.sessionID) {
		const log = await readSessionLog(options.sessionID, logsRoot);
		return log ? Object.freeze([log]) : Object.freeze([]);
	}

	if (options?.runId) {
		return readLogsForRun(options.runId, logsRoot);
	}

	const latest = await readLatestSessionLog(logsRoot);
	return latest ? Object.freeze([latest]) : Object.freeze([]);
}

function buildDetailSummary(logs: readonly SessionLog[]): string {
	if (logs.length === 0) {
		return "";
	}

	if (logs.length === 1) {
		return generateSessionSummary(logs[0]);
	}

	return logs.map((log) => generateSessionSummary(log)).join("\n\n---\n\n");
}

function buildMissingTargetMessage(options: LogsOptions | undefined): string {
	if (options?.sessionID) {
		return `Session "${options.sessionID}" not found.`;
	}

	if (options?.runId) {
		return `Run "${options.runId}" did not resolve to any session logs.`;
	}

	return "No session logs found.";
}

/**
 * Core function for the oc_logs tool.
 *
 * @param mode - "list", "detail", or "search"
 * @param options - Optional filters (sessionID, runId, eventType, after, before)
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
			const logs = await resolveSessionLogs(options, logsRoot);
			const log = logs[0] ?? null;

			if (!log) {
				return JSON.stringify({
					action: "error",
					message: buildMissingTargetMessage(options),
				});
			}

			const summary = buildDetailSummary(logs);

			return JSON.stringify({
				action: "logs_detail",
				runId: options?.runId,
				resolvedSessionIds: logs.map((entry) => entry.sessionId),
				sessionLog: log,
				sessionLogs: logs.length > 1 ? logs : undefined,
				summary,
				displayText: summary,
			});
		}

		case "search": {
			const logs = await resolveSessionLogs(options, logsRoot);
			const log = logs[0] ?? null;

			if (!log) {
				return JSON.stringify({
					action: "error",
					message: buildMissingTargetMessage(options),
				});
			}

			const filtered = searchEvents(
				logs.flatMap((entry) => entry.events),
				{
					type: options?.eventType,
					after: options?.after,
					before: options?.before,
					domain: options?.domain,
					subsystem: options?.subsystem,
					severity: options?.severity,
				},
			);

			const displayLines = [
				`Search Results (${filtered.length} event(s))`,
				"",
				...filtered.map((event) => `[${event.timestamp}] ${event.type}: ${JSON.stringify(event)}`),
			];

			return JSON.stringify({
				action: "logs_search",
				runId: options?.runId,
				sessionId: log.sessionId,
				sessionIds: logs.map((entry) => entry.sessionId),
				filters: {
					runId: options?.runId,
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
		"summary, 'search' filters events by type/time/domain/subsystem/severity. Accepts sessionID or runId to resolve correlated logs.",
	args: {
		mode: z.enum(["list", "detail", "search"]).describe("View mode: list, detail, or search"),
		sessionID: z
			.string()
			.regex(/^[a-zA-Z0-9_-]{1,256}$/)
			.optional()
			.describe("Session ID to view (uses latest if omitted)"),
		runId: z
			.string()
			.regex(/^[a-zA-Z0-9_-]{1,256}$/)
			.optional()
			.describe("Run ID to resolve through pending dispatch session correlation"),
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
	async execute({ mode, sessionID, runId, eventType, after, before, domain, subsystem, severity }) {
		return logsCore(mode, {
			sessionID,
			runId,
			eventType,
			after,
			before,
			domain,
			subsystem,
			severity,
		});
	},
});
