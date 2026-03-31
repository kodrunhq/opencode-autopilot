import { reviewFindingSchema } from "./schemas";
import { compareSeverity } from "./severity";
import type { AgentCategory, AgentResult, ReviewFinding } from "./types";

interface FindingInput {
	readonly severity: string;
	readonly domain: string;
	readonly title: string;
	readonly file: string;
	readonly line?: number;
	readonly agent: string;
	readonly source: "phase1" | "cross-verification" | "product-review" | "red-team";
	readonly evidence: string;
	readonly problem: string;
	readonly fix: string;
}

/**
 * Create an immutable, Zod-validated ReviewFinding.
 * Throws if the input fails schema validation (e.g., invalid severity).
 */
export function createFinding(input: FindingInput): Readonly<ReviewFinding> {
	const validated = reviewFindingSchema.parse(input);
	return Object.freeze(validated);
}

interface AgentResultInput {
	readonly agent: string;
	readonly category: AgentCategory;
	readonly findings: readonly ReviewFinding[];
	readonly durationMs: number;
}

/**
 * Create an immutable AgentResult with auto-timestamped completedAt.
 */
export function createAgentResult(input: AgentResultInput): Readonly<AgentResult> {
	const result: AgentResult = {
		agent: input.agent,
		category: input.category,
		findings: [...input.findings],
		durationMs: input.durationMs,
		completedAt: new Date().toISOString(),
	};
	return Object.freeze(result);
}

/**
 * Merge findings from multiple sources, deduplicate by file+title
 * (keeping the higher severity), and sort by severity (CRITICAL first).
 */
export function mergeFindings(findings: readonly ReviewFinding[]): readonly ReviewFinding[] {
	// Deduplicate by file+title, keeping higher severity
	const deduped = new Map<string, ReviewFinding>();

	for (const finding of findings) {
		const key = `${finding.file}::${finding.title}`;
		const existing = deduped.get(key);

		if (existing === undefined) {
			deduped.set(key, finding);
		} else {
			// Keep the one with higher severity (compareSeverity returns negative if first is higher)
			if (compareSeverity(finding.severity, existing.severity) < 0) {
				deduped.set(key, finding);
			}
		}
	}

	// Sort by severity: CRITICAL first, then WARNING, then NITPICK
	const sorted = [...deduped.values()].sort((a, b) => compareSeverity(a.severity, b.severity));

	return Object.freeze(sorted);
}
