/**
 * Report builder for the review engine.
 *
 * Aggregates findings into a structured, deduplicated, severity-sorted report.
 * Groups findings by file, sorts by severity within each group, and computes
 * summary counts and verdict.
 */

import { reviewReportSchema } from "./schemas";
import { compareSeverity } from "./severity";
import type { ReviewFinding, ReviewReport, Severity, Verdict } from "./types";

export const SEVERITY_ORDER = Object.freeze({
	CRITICAL: 0,
	WARNING: 1,
	NITPICK: 2,
} as const);

/**
 * Deduplicate findings by agent:file:line key.
 * On collision (same agent, file, line), keeps the higher severity version.
 * Returns a new array (no mutation).
 */
export function deduplicateFindings(findings: readonly ReviewFinding[]): readonly ReviewFinding[] {
	const deduped = new Map<string, ReviewFinding>();

	for (const finding of findings) {
		const key = `${finding.agent}:${finding.file}:${finding.line ?? 0}`;
		const existing = deduped.get(key);

		if (existing === undefined) {
			deduped.set(key, finding);
		} else {
			// compareSeverity returns negative if first arg is higher severity
			if (compareSeverity(finding.severity, existing.severity) < 0) {
				deduped.set(key, finding);
			}
		}
	}

	return [...deduped.values()];
}

/**
 * Determine the verdict based on findings.
 */
function determineVerdict(findings: readonly ReviewFinding[]): Verdict {
	if (findings.length === 0) return "CLEAN";

	const hasCritical = findings.some((f) => f.severity === "CRITICAL");
	if (hasCritical) return "BLOCKED";

	const hasWarning = findings.some((f) => f.severity === "WARNING");
	if (hasWarning) return "CONCERNS";

	return "APPROVED";
}

/**
 * Build a summary string with severity counts.
 */
function buildSummary(findings: readonly ReviewFinding[]): string {
	const counts: Record<Severity, number> = { CRITICAL: 0, WARNING: 0, NITPICK: 0 };
	for (const f of findings) {
		counts[f.severity] += 1;
	}

	const total = findings.length;
	if (total === 0) return "No findings. Code looks clean.";

	const parts: string[] = [];
	if (counts.CRITICAL > 0) parts.push(`${counts.CRITICAL} CRITICAL`);
	if (counts.WARNING > 0) parts.push(`${counts.WARNING} WARNING`);
	if (counts.NITPICK > 0) parts.push(`${counts.NITPICK} NITPICK`);

	return `${total} findings: ${parts.join(", ")}.`;
}

/**
 * Build a structured review report from findings.
 *
 * 1. Deduplicates findings
 * 2. Groups by file, sorts by severity within each file (CRITICAL first)
 * 3. Computes summary counts and verdict
 * 4. Validates through reviewReportSchema
 * 5. Returns frozen report
 */
export function buildReport(
	findings: readonly ReviewFinding[],
	scope: string,
	agentsRan: readonly string[],
): ReviewReport {
	// 1. Deduplicate
	const deduped = deduplicateFindings(findings);

	// 2. Group by file, sort by severity within each file
	const byFile = new Map<string, ReviewFinding[]>();
	for (const f of deduped) {
		const group = byFile.get(f.file);
		if (group) {
			group.push(f);
		} else {
			byFile.set(f.file, [f]);
		}
	}

	// Sort within each file group, then flatten
	const sorted: ReviewFinding[] = [];
	const sortedFileKeys = [...byFile.keys()].sort();
	for (const file of sortedFileKeys) {
		const group = byFile.get(file);
		if (group) {
			group.sort((a, b) => compareSeverity(a.severity, b.severity));
			sorted.push(...group);
		}
	}

	// 3. Compute verdict and summary
	const verdict = determineVerdict(sorted);
	const summary = buildSummary(sorted);

	// 4. Validate through schema
	const report = reviewReportSchema.parse({
		verdict,
		findings: sorted,
		agentResults: [],
		scope,
		agentsRan: [...agentsRan],
		totalDurationMs: 0,
		completedAt: new Date().toISOString(),
		summary,
	});

	// 5. Return frozen
	return Object.freeze(report);
}
