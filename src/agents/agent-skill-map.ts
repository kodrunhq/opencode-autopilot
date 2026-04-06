/**
 * Maps top-level agent names to the skill names they require.
 *
 * When a top-level agent's system prompt is loaded, the skill injector
 * reads this map to determine which skills to load from disk and append
 * to the prompt via the adaptive skill injection system.
 *
 * Skills listed here must exist in ~/.config/opencode/skills/{name}/SKILL.md.
 * Missing skills are silently skipped (best-effort injection).
 */

/** Agent name → ordered list of skill names to inject at runtime. */
export const AGENT_SKILL_MAP: Readonly<Record<string, readonly string[]>> = Object.freeze({
	coder: Object.freeze(["tdd-workflow", "coding-standards"]),
	planner: Object.freeze(["plan-writing", "plan-executing"]),
	reviewer: Object.freeze(["code-review"]),
	debugger: Object.freeze(["systematic-debugging"]),
	"security-auditor": Object.freeze(["security-patterns"]),
});

/**
 * Prompt prefixes used to detect which agent is active in a system.transform call.
 *
 * The system.transform hook receives the full system prompt but not the agent name.
 * We identify the agent by matching the start of the prompt against known prefixes.
 * Each prefix is the first sentence of the agent's prompt — stable across refactors
 * because changing an agent's identity sentence is a deliberate, breaking change.
 */
export const AGENT_PROMPT_PREFIXES: Readonly<Record<string, string>> = Object.freeze({
	coder: "You are the coder agent.",
	planner: "You are the planner agent.",
	reviewer: "You are the code reviewer agent.",
	debugger: "You are the debugger agent.",
	"security-auditor": "You are a security auditor.",
});

/**
 * Detect agent name from a system prompt string by matching known prefixes.
 * Returns the agent name if found, undefined otherwise.
 */
export function detectAgentFromPrompt(systemPrompt: string): string | undefined {
	for (const [agentName, prefix] of Object.entries(AGENT_PROMPT_PREFIXES)) {
		if (systemPrompt.startsWith(prefix)) {
			return agentName;
		}
	}
	return undefined;
}
