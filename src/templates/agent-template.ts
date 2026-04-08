import { stringify } from "yaml";

export interface AgentTemplateInput {
	readonly name: string;
	readonly description: string;
	readonly mode: "primary" | "subagent" | "all";
	readonly model?: string;
	readonly temperature?: number;
	readonly permission?: Record<string, string>;
}

const DEFAULT_PERMISSION: Readonly<Record<string, string>> = Object.freeze({
	read: "allow",
	edit: "deny",
	bash: "deny",
	webfetch: "deny",
	task: "deny",
	todowrite: "deny",
});

export function generateAgentMarkdown(input: AgentTemplateInput): string {
	const frontmatter: Record<string, unknown> = {
		description: input.description,
		mode: input.mode,
		...(input.model !== undefined && { model: input.model }),
		...(input.temperature !== undefined && { temperature: input.temperature }),
		permission: input.permission ?? DEFAULT_PERMISSION,
	};

	return `---
${stringify(frontmatter).trim()}
---
You are ${input.name}, an AI agent.

<!-- TODO: Replace the placeholder text in each section below with specific instructions for your agent. -->
<!-- Follow this structure: Identity → Role → Instructions → Constraints → Error Recovery -->

## Role

<!-- Define your agent's primary role, expertise, and scope. Be specific about what this agent does and does NOT do. -->

[Describe the agent's specialty. Example: "You analyze pull requests for security vulnerabilities, focusing on OWASP Top 10 issues and authentication flaws. You do NOT write or modify code directly."]

## Instructions

<!-- List the step-by-step process your agent follows for every task. Number each step. -->

1. [First step — how the agent begins processing a task. Example: "Read all files relevant to the request before taking action."]
2. [Core analysis or implementation step. Example: "Identify the root cause before proposing a fix."]
3. [Validation or verification step. Example: "Run the test suite and confirm all tests pass before reporting success."]
4. [Final delivery — present findings, write output, etc. Example: "Summarize findings with severity levels: CRITICAL, WARNING, INFO."]

## Constraints

<!-- Specify hard rules: what this agent must always do and must never do. -->

- DO [primary expected behavior. Example: "use bash to run tests after every change"].
- DO [second expected behavior. Example: "explain your reasoning before making changes"].
- DO NOT [primary restriction. Example: "modify files outside the directory specified in the task"].
- DO NOT [second restriction. Example: "access the web unless the task explicitly requires it"].

## Error Recovery

<!-- Describe how the agent handles common failure scenarios instead of silently halting. -->

- If [common failure scenario. Example: "a test fails after a change"], then [recovery action. Example: "revert the change, diagnose the failure, and report before retrying"].
- If [second failure scenario. Example: "a required file is missing"], then [recovery action. Example: "report which file is missing and what it is needed for, then halt"].
- NEVER halt silently — always report what went wrong and what was attempted.
`;
}
