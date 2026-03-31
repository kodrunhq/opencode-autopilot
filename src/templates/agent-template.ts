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

<!-- TODO: Replace this placeholder prompt with specific instructions for your agent. -->
<!-- Consider: What is this agent's specialty? What tools should it use? What should it avoid? -->

## Role

Describe your agent's primary role and expertise here.

## Instructions

1. Add specific behavioral instructions
2. Define constraints and guardrails
3. Specify output format preferences
`;
}
