/**
 * oc_pipeline_report tool - Decision trace with phase-by-phase breakdown.
 *
 * Reads a session log and produces a read-only report showing:
 * - Phase-by-phase decision timeline
 * - Per-phase decision count
 * - Decisions with agent, rationale, and confidence context
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
 * A decision entry within a phase section of the report.
 */
interface ReportDecision {
	readonly agent: string;
	readonly decision: string;
	readonly rationale: string;
}

/**
 * A phase section in the pipeline report.
 */
interface ReportPhase {
	readonly phase: string;
	readonly decisions: readonly ReportDecision[];
}

/**
 * Groups decisions by phase, preserving insertion order.
 */
function groupDecisionsByPhase(log: SessionLog): readonly ReportPhase[] {
	const phaseOrder: string[] = [];
	const phaseMap = new Map<string, ReportDecision[]>();

	for (const d of log.decisions) {
		if (!phaseMap.has(d.phase)) {
			phaseOrder.push(d.phase);
			phaseMap.set(d.phase, []);
		}
		const decisions = phaseMap.get(d.phase);
		decisions?.push({
			agent: d.agent,
			decision: d.decision,
			rationale: d.rationale,
		});
	}

	return phaseOrder.map((phase) => ({
		phase,
		decisions: phaseMap.get(phase) ?? [],
	}));
}

/**
 * Builds the displayText report for the pipeline report.
 */
function buildDisplayText(
	log: SessionLog,
	phases: readonly ReportPhase[],
	durationMs: number,
): string {
	const lines: string[] = [];

	// Header
	const durationStr = log.endedAt ? formatDuration(durationMs) : "In progress";
	lines.push(`Pipeline Report: ${log.sessionId}`);
	lines.push(`Duration: ${durationStr}`);
	lines.push(`Total Decisions: ${log.decisions.length}`);
	lines.push("");

	if (phases.length === 0) {
		lines.push("No decisions recorded in this session.");
		return lines.join("\n");
	}

	// Phase-by-phase breakdown
	for (const phase of phases) {
		lines.push(`--- ${phase.phase} (${phase.decisions.length} decision(s)) ---`);
		for (const d of phase.decisions) {
			lines.push(`  [${d.agent}] ${d.decision}`);
			lines.push(`    Rationale: ${d.rationale}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Core function for the oc_pipeline_report tool.
 *
 * @param sessionID - Optional session ID (uses latest if omitted)
 * @param logsDir - Optional override for logs directory (for testing)
 */
export async function pipelineReportCore(sessionID?: string, logsDir?: string): Promise<string> {
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
	const phases = groupDecisionsByPhase(log);
	const totalDecisions = log.decisions.length;
	const displayText = buildDisplayText(log, phases, durationMs);

	return JSON.stringify({
		action: "pipeline_report",
		sessionId: log.sessionId,
		phases,
		totalDecisions,
		displayText,
	});
}

// --- Tool wrapper ---

export const ocPipelineReport = tool({
	description:
		"View pipeline decision trace. Shows phase-by-phase breakdown of all autonomous decisions " +
		"with agent, rationale, and confidence. Read-only report for post-session analysis.",
	args: {
		sessionID: z.string().optional().describe("Session ID to view (uses latest if omitted)"),
	},
	async execute({ sessionID }) {
		return pipelineReportCore(sessionID);
	},
});
