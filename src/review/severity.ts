import type { Severity } from "./types";

interface SeverityDefinition {
	readonly criteria: readonly string[];
	readonly action: string;
}

export const SEVERITY_DEFINITIONS: Readonly<Record<Severity, SeverityDefinition>> = Object.freeze({
	CRITICAL: Object.freeze({
		criteria: Object.freeze([
			"Runtime error on a common code path (null dereference, missing import, type mismatch)",
			"Data loss or corruption (wrong delete, missing transaction, race condition on write)",
			"Security vulnerability (injection, auth bypass, exposed secrets)",
			"API contract broken (frontend and backend disagree on shape/method/URL)",
			"Feature fundamentally does not work (CRUD missing a letter, broken wiring)",
		]),
		action: "Must fix before push. Blocks PR.",
	}),
	WARNING: Object.freeze({
		criteria: Object.freeze([
			"Edge case not handled (null input, empty list, boundary value)",
			"Test exists but does not actually verify behavior (no assertions, mocked too broadly)",
			"Partial implementation (feature half-built, TODO left in production code)",
			"Error handling missing or swallows errors silently",
			"Performance issue on a hot path",
		]),
		action: "Should fix before push. Does not block but strongly recommended.",
	}),
	NITPICK: Object.freeze({
		criteria: Object.freeze([
			"Naming inconsistency with codebase conventions",
			"Unused import or dead code",
			"Console.log or debug statement left in",
			"Comment is outdated or misleading",
			"Code style does not match surrounding code",
		]),
		action: "Fix if convenient. Will not block or flag.",
	}),
});

const SEVERITY_RANK: Readonly<Record<Severity, number>> = Object.freeze({
	CRITICAL: 0,
	WARNING: 1,
	NITPICK: 2,
});

/**
 * Compare two severities for sorting. Returns negative if a is higher severity,
 * positive if b is higher, zero if equal.
 */
export function compareSeverity(a: Severity, b: Severity): number {
	return SEVERITY_RANK[a] - SEVERITY_RANK[b];
}

/**
 * Returns true if the severity blocks a PR (only CRITICAL blocks).
 */
export function isBlockingSeverity(severity: Severity): boolean {
	return severity === "CRITICAL";
}
