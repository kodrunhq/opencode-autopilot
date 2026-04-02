/**
 * oc_session_stats tool - Event counts, decisions, errors, and per-phase breakdown.
 *
 * Reads a session log and computes:
 * - Event count totals
 * - Decision count and per-phase grouping
 * - Error summary by type with per-phase attribution
 * - Session duration
 * - Per-phase breakdown (when decisions span multiple phases)
 *
 * Follows the *Core + tool() wrapper pattern per CLAUDE.md.
 * Returns JSON with displayText field following oc_doctor pattern.
 *
 * @module
 */

import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { readLatestSessionLog, readSessionLog } from "../observability/log-reader";
import { computeDuration, formatDuration } from "../observability/summary-generator";
import type { SessionLog } from "../observability/types";

/**
 * Per-phase breakdown entry.
 */
interface PhaseBreakdownEntry {
	readonly phase: string;
	readonly decisionCount: number;
	readonly errorCount: number;
}

/**
 * Computes per-phase breakdown from session log decisions and events.
 * Groups decisions by phase and counts errors per phase time window.
 *
 * Error-to-phase mapping: for each error event, find the phase whose
 * decision time window (first to last decision timestamp) contains the
 * error timestamp. Unmatched errors are not attributed to any phase
 * (they still appear in the overall errorSummary).
 */
function computePhaseBreakdown(log: SessionLog): readonly PhaseBreakdownEntry[] {
	const phaseMap = new Map<string, { decisions: number; errors: number }>();

	// Collect per-phase time windows from decisions
	const phaseWindows = new Map<string, { start: string; end: string }>();

	for (const d of log.decisions) {
		const existing = phaseMap.get(d.phase) ?? { decisions: 0, errors: 0 };
		phaseMap.set(d.phase, { ...existing, decisions: existing.decisions + 1 });

		const ts = d.timestamp ?? "";
		if (!ts) continue; // Skip decisions without timestamps — cannot build time windows
		const window = phaseWindows.get(d.phase);
		if (!window) {
			phaseWindows.set(d.phase, { start: ts, end: ts });
		} else {
			if (ts < window.start) phaseWindows.set(d.phase, { ...window, start: ts });
			if (ts > window.end) phaseWindows.set(d.phase, { ...window, end: ts });
		}
	}

	// Map errors to phases by timestamp overlap with phase time windows
	for (const e of log.events) {
		if (e.type === "error") {
			for (const [phase, window] of phaseWindows) {
				if (e.timestamp >= window.start && e.timestamp <= window.end) {
					const data = phaseMap.get(phase);
					if (data) {
						phaseMap.set(phase, { ...data, errors: data.errors + 1 });
					}
					break;
				}
			}
		}
	}

	const result: PhaseBreakdownEntry[] = [];
	for (const [phase, data] of phaseMap) {
		result.push({
			phase,
			decisionCount: data.decisions,
			errorCount: data.errors,
		});
	}

	return result;
}

/**
 * Builds the displayText report for session stats.
 */
function buildDisplayText(
	log: SessionLog,
	durationMs: number,
	phaseBreakdown: readonly PhaseBreakdownEntry[],
): string {
	const lines: string[] = [];

	// Header
	lines.push(`Session Stats: ${log.sessionId}`);
	lines.push("");

	// Duration
	const durationStr = log.endedAt ? formatDuration(durationMs) : "In progress";
	lines.push(`Duration: ${durationStr}`);
	lines.push(`Events: ${log.events.length}`);
	lines.push(`Decisions: ${log.decisions.length}`);
	lines.push("");

	// Error summary
	const errorEntries = Object.entries(log.errorSummary);
	if (errorEntries.length > 0) {
		lines.push("Error Summary:");
		for (const [type, count] of errorEntries) {
			lines.push(`  ${type}: ${count}`);
		}
		lines.push("");
	}

	// Per-phase breakdown (when phases exist)
	if (phaseBreakdown.length > 0) {
		lines.push("Phase Breakdown:");
		lines.push("| Phase | Decisions | Errors |");
		lines.push("|-------|-----------|--------|");
		for (const p of phaseBreakdown) {
			lines.push(`| ${p.phase} | ${p.decisionCount} | ${p.errorCount} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Core function for the oc_session_stats tool.
 *
 * @param sessionID - Optional session ID (uses latest if omitted)
 * @param logsDir - Optional override for logs directory (for testing)
 */
export async function sessionStatsCore(sessionID?: string, logsDir?: string): Promise<string> {
	const log = sessionID
		? await readSessionLog(sessionID, logsDir)
		: await readLatestSessionLog(logsDir);

	if (!log) {
		const target = sessionID ? `Session "${sessionID}" not found.` : "No session logs found.";
		return JSON.stringify({
			action: "error",
			message: target,
		});
	}

	const durationMs = computeDuration(log);
	const phaseBreakdown = computePhaseBreakdown(log);
	const displayText = buildDisplayText(log, durationMs, phaseBreakdown);

	return JSON.stringify({
		action: "session_stats",
		sessionId: log.sessionId,
		duration: durationMs,
		eventCount: log.events.length,
		decisionCount: log.decisions.length,
		errorSummary: log.errorSummary,
		phaseBreakdown,
		displayText,
	});
}

// --- Tool wrapper ---

export const ocSessionStats = tool({
	description:
		"View session statistics including event counts, decisions, errors, and per-phase breakdown. " +
		"Shows duration, error summary, and phase-by-phase activity.",
	args: {
		sessionID: z
			.string()
			.regex(/^[a-zA-Z0-9_-]{1,256}$/)
			.optional()
			.describe("Session ID to view (uses latest if omitted)"),
	},
	async execute({ sessionID }) {
		return sessionStatsCore(sessionID);
	},
});
