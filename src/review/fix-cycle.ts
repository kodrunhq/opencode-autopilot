/**
 * Fix cycle logic for the review engine.
 *
 * Determines which CRITICAL findings have actionable suggestions,
 * and builds re-run prompts for only the affected agents.
 * Vague suggestions (containing "consider", "might", "perhaps", etc.)
 * or very short suggestions are filtered out.
 */

import type { ReviewAgent, ReviewFinding } from "./types";

/**
 * Strip {{PLACEHOLDER}} tokens from untrusted content before template substitution.
 */
function sanitizeTemplateContent(content: string): string {
	return content.replace(/\{\{[A-Z_]+\}\}/g, "[REDACTED]");
}

export interface FixInstructions {
	readonly fixable: readonly ReviewFinding[];
	readonly agentsToRerun: readonly string[];
	readonly skipped: readonly { readonly finding: ReviewFinding; readonly reason: string }[];
}

const VAGUE_INDICATORS = ["consider", "might want to", "perhaps", "could potentially"] as const;
const MIN_SUGGESTION_LENGTH = 20;

/**
 * Check if a suggestion is vague/non-actionable.
 */
function isVagueSuggestion(fix: string): boolean {
	const lower = fix.toLowerCase();
	return VAGUE_INDICATORS.some((indicator) => lower.includes(indicator));
}

/**
 * Determine which findings are fixable and which agents need re-running.
 *
 * Filters to CRITICAL severity only, with actionable (non-vague, long enough) suggestions.
 * Returns frozen result with fixable, agentsToRerun, and skipped lists.
 */
export function determineFixableFindings(findings: readonly ReviewFinding[]): FixInstructions {
	const fixable: ReviewFinding[] = [];
	const skipped: { readonly finding: ReviewFinding; readonly reason: string }[] = [];

	for (const finding of findings) {
		// Only CRITICAL severity
		if (finding.severity !== "CRITICAL") {
			skipped.push(
				Object.freeze({
					finding,
					reason: `Skipped: ${finding.severity} severity (only CRITICAL are fixable)`,
				}),
			);
			continue;
		}

		// Check suggestion length
		if (finding.fix.length < MIN_SUGGESTION_LENGTH) {
			skipped.push(
				Object.freeze({ finding, reason: "Skipped: suggestion too short (< 20 chars)" }),
			);
			continue;
		}

		// Check for vague indicators
		if (isVagueSuggestion(finding.fix)) {
			skipped.push(Object.freeze({ finding, reason: "Skipped: vague suggestion detected" }));
			continue;
		}

		fixable.push(finding);
	}

	// Build unique set of agent names from fixable findings
	const agentSet = new Set<string>();
	for (const f of fixable) {
		agentSet.add(f.agent);
	}

	return Object.freeze({
		fixable: Object.freeze(fixable),
		agentsToRerun: Object.freeze([...agentSet]),
		skipped: Object.freeze(skipped),
	});
}

/**
 * Build re-run prompts for agents whose findings were fixable.
 *
 * For each unique agent in the fixable set:
 * - Uses the agent's original prompt with {{DIFF}} replaced by the updated diff
 * - Includes the specific findings that should have been fixed
 * - Adds instructions to verify fixes and check for regressions
 *
 * Only agents whose findings appear in the fixable set are included.
 */
export function buildFixInstructions(
	fixable: readonly ReviewFinding[],
	agents: readonly ReviewAgent[],
	diff: string,
): readonly { readonly name: string; readonly prompt: string }[] {
	// Group fixable findings by agent
	const findingsByAgent = new Map<string, ReviewFinding[]>();
	for (const f of fixable) {
		const group = findingsByAgent.get(f.agent);
		if (group) {
			group.push(f);
		} else {
			findingsByAgent.set(f.agent, [f]);
		}
	}

	const results: { readonly name: string; readonly prompt: string }[] = [];

	for (const agent of agents) {
		const agentFindings = findingsByAgent.get(agent.name);
		if (!agentFindings || agentFindings.length === 0) continue;

		// Build findings list for the prompt
		const findingsList = agentFindings
			.map((f) => `- [${f.severity}] ${f.title} in ${f.file}${f.line ? `:${f.line}` : ""}`)
			.join("\n");

		// Sanitize untrusted content and replace placeholders
		const safeDiff = sanitizeTemplateContent(diff);
		const basePrompt = agent.prompt
			.replace("{{DIFF}}", safeDiff)
			.replace("{{PRIOR_FINDINGS}}", "")
			.replace("{{MEMORY}}", "");

		const fixCyclePrompt = `${basePrompt}

## Fix Cycle - Verification Pass

The following findings were reported in the previous review and should have been fixed.
Please verify each fix is correct and check for any regressions introduced by the fixes.

### Findings to verify:
${findingsList}

### Instructions:
1. For each finding above, verify the fix is correct and complete
2. Check for any regression bugs introduced by the fixes
3. Report any NEW issues found in the fixed code
4. If a finding was NOT fixed, report it again with the same severity`;

		results.push(Object.freeze({ name: agent.name, prompt: fixCyclePrompt }));
	}

	return Object.freeze(results);
}
