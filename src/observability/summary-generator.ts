/**
 * Session summary generator.
 *
 * Transforms structured SessionLog data into human-readable markdown summaries
 * for post-session analysis. All functions are pure (no I/O, no side effects).
 *
 * Summaries include: metadata, decisions, errors, fallbacks, model switches,
 * and a strategic one-paragraph analysis (D-03, D-11, D-42, D-43).
 */

import type { SessionEvent, SessionLog } from "./types";

/**
 * Computes session duration in milliseconds from startedAt/endedAt.
 * Returns 0 when endedAt is null (session still in progress).
 */
export function computeDuration(log: SessionLog): number {
	if (!log.endedAt) return 0;
	return new Date(log.endedAt).getTime() - new Date(log.startedAt).getTime();
}

/**
 * Formats duration in milliseconds to human-readable string.
 * Uses "Xh Ym" for durations >= 1 hour, "Xm Ys" for >= 1 minute, "Xs" otherwise.
 */
export function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

/**
 * Formats cost as USD string with 4 decimal places.
 */
export function formatCost(cost: number): string {
	return `$${cost.toFixed(4)}`;
}

/**
 * Generates a complete markdown summary from a SessionLog.
 *
 * Includes sections for: metadata, decisions, errors, fallbacks,
 * model switches, and strategic summary. Sections are omitted when
 * no relevant data exists.
 */
export function generateSessionSummary(log: SessionLog): string {
	const sections: string[] = [];

	// Header
	sections.push(renderHeader(log));

	// Decisions section (conditional)
	if (log.decisions.length > 0) {
		sections.push(renderDecisions(log));
	}

	// Errors section (conditional)
	const errorEvents = log.events.filter(
		(e): e is SessionEvent & { type: "error" } => e.type === "error",
	);
	if (errorEvents.length > 0) {
		sections.push(renderErrors(errorEvents, log.errorSummary));
	}

	// Fallbacks section (conditional)
	const fallbackEvents = log.events.filter(
		(e): e is SessionEvent & { type: "fallback" } => e.type === "fallback",
	);
	if (fallbackEvents.length > 0) {
		sections.push(renderFallbacks(fallbackEvents));
	}

	// Model switches section (conditional)
	const switchEvents = log.events.filter(
		(e): e is SessionEvent & { type: "model_switch" } => e.type === "model_switch",
	);
	if (switchEvents.length > 0) {
		sections.push(renderModelSwitches(switchEvents));
	}

	// Strategic summary (always present, varies by content)
	sections.push(renderStrategicSummary(log));

	return sections.join("\n\n");
}

// --- Internal renderers ---

function renderHeader(log: SessionLog): string {
	const durationMs = computeDuration(log);
	const durationStr = log.endedAt ? formatDuration(durationMs) : "In progress";

	return [
		`# Session Summary: ${log.sessionId}`,
		"",
		"| Field | Value |",
		"|-------|-------|",
		`| Started | ${log.startedAt} |`,
		`| Ended | ${log.endedAt ?? "In progress"} |`,
		`| Duration | ${durationStr} |`,
		`| Events | ${log.events.length} |`,
		`| Decisions | ${log.decisions.length} |`,
	].join("\n");
}

function renderDecisions(log: SessionLog): string {
	const lines = ["## Decisions", ""];

	for (let i = 0; i < log.decisions.length; i++) {
		const d = log.decisions[i];
		lines.push(`${i + 1}. **[${d.phase}] ${d.agent}**: ${d.decision}`);
		lines.push(`   - _Rationale:_ ${d.rationale}`);
	}

	return lines.join("\n");
}

function renderErrors(
	events: readonly (SessionEvent & { type: "error" })[],
	errorSummary: Record<string, number>,
): string {
	const lines = [
		"## Errors",
		"",
		"| Timestamp | Type | Model | Message |",
		"|-----------|------|-------|---------|",
	];

	for (const e of events) {
		const safeMsg = (e.message ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
		const safeModel = (e.model ?? "").replace(/\|/g, "\\|");
		lines.push(`| ${e.timestamp} | ${e.errorType} | ${safeModel} | ${safeMsg} |`);
	}

	// Error summary counts
	const summaryEntries = Object.entries(errorSummary);
	if (summaryEntries.length > 0) {
		lines.push("");
		lines.push("**Error Summary:**");
		for (const [type, count] of summaryEntries) {
			lines.push(`- ${type}: ${count}`);
		}
	}

	return lines.join("\n");
}

function renderFallbacks(events: readonly (SessionEvent & { type: "fallback" })[]): string {
	const lines = [
		"## Fallbacks",
		"",
		"| Timestamp | Failed Model | Next Model | Reason | Success |",
		"|-----------|-------------|------------|--------|---------|",
	];

	for (const e of events) {
		lines.push(
			`| ${e.timestamp} | ${e.failedModel} | ${e.nextModel} | ${e.reason} | ${e.success ? "Yes" : "No"} |`,
		);
	}

	return lines.join("\n");
}

function renderModelSwitches(events: readonly (SessionEvent & { type: "model_switch" })[]): string {
	const lines = [
		"## Model Switches",
		"",
		"| Timestamp | From | To | Trigger |",
		"|-----------|------|----|---------|",
	];

	for (const e of events) {
		lines.push(`| ${e.timestamp} | ${e.fromModel} | ${e.toModel} | ${e.trigger} |`);
	}

	return lines.join("\n");
}

function renderStrategicSummary(log: SessionLog): string {
	const errorCount = log.events.filter((e) => e.type === "error").length;
	const fallbackCount = log.events.filter((e) => e.type === "fallback").length;
	const durationMs = computeDuration(log);
	const durationStr = log.endedAt ? formatDuration(durationMs) : "unknown (in progress)";

	const parts: string[] = [];
	parts.push(
		`Session ran for ${durationStr} with ${log.events.length} events and ${log.decisions.length} autonomous decisions.`,
	);

	if (errorCount > 0) {
		const successfulFallbacks = log.events.filter((e) => e.type === "fallback" && e.success).length;
		parts.push(
			`Encountered ${errorCount} errors; ${fallbackCount} fallback attempts (${successfulFallbacks} successful).`,
		);
	}

	if (log.decisions.length > 0) {
		const phases = [...new Set(log.decisions.map((d) => d.phase))];
		parts.push(`Decisions spanned ${phases.length} phase(s): ${phases.join(", ")}.`);
	}

	return ["## Summary", "", parts.join(" ")].join("\n");
}
