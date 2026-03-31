/**
 * Cross-verification prompt builder.
 *
 * After Stage 1 review, each agent receives condensed findings from ALL OTHER
 * agents so they can upgrade severities, add missed findings, or confirm results.
 * Uses a 1-line condensed format to prevent token budget explosion (Pitfall 2).
 */

import type { ReviewFinding } from "./types";

/** Minimal agent shape needed for cross-verification. */
interface PromptableAgent {
	readonly name: string;
	readonly prompt: string;
	readonly [key: string]: unknown;
}

/**
 * Condense a finding to a single line for cross-verification context.
 * Format: [agent] [severity] [file:line] title (truncated to ~120 chars)
 *
 * Max ~150 chars per finding to prevent token budget explosion.
 */
export function condenseFinding(finding: ReviewFinding): string {
	const lineRef = finding.line ? `${finding.file}:${finding.line}` : finding.file;
	const truncatedTitle =
		finding.title.length > 120 ? `${finding.title.slice(0, 117)}...` : finding.title;
	return `[${finding.agent}] [${finding.severity}] [${lineRef}] ${truncatedTitle}`;
}

/**
 * Build cross-verification prompts for each agent.
 *
 * Each agent receives:
 * 1. Its original prompt with {{DIFF}} replaced by the actual diff
 * 2. A {{PRIOR_FINDINGS}} section with condensed findings from all OTHER agents
 * 3. Instructions to upgrade, add, or confirm findings
 *
 * An agent's own findings are NEVER included in its prompt.
 */
export function buildCrossVerificationPrompts(
	agents: readonly PromptableAgent[],
	findingsByAgent: ReadonlyMap<string, readonly ReviewFinding[]>,
	diff: string,
): readonly { readonly name: string; readonly prompt: string }[] {
	const results: { readonly name: string; readonly prompt: string }[] = [];

	for (const agent of agents) {
		// Collect condensed findings from all OTHER agents
		const otherFindings: string[] = [];
		for (const [agentName, findings] of findingsByAgent) {
			if (agentName === agent.name) continue;
			for (const f of findings) {
				otherFindings.push(condenseFinding(f));
			}
		}

		const priorFindingsBlock =
			otherFindings.length > 0 ? otherFindings.join("\n") : "No findings from other agents yet.";

		const crossVerifyInstruction = `Review these findings from other agents. You may: (1) UPGRADE severity with justification, (2) ADD a new finding you missed, (3) Report no changes.`;

		// Replace placeholders in the agent's prompt
		const prompt = agent.prompt
			.replace("{{DIFF}}", diff)
			.replace("{{PRIOR_FINDINGS}}", `${priorFindingsBlock}\n\n${crossVerifyInstruction}`)
			.replace("{{MEMORY}}", "");

		results.push(Object.freeze({ name: agent.name, prompt }));
	}

	return Object.freeze(results);
}
