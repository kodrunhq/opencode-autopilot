import type { AgentConfig } from "@opencode-ai/sdk";

export const ocImplementerAgent: Readonly<AgentConfig> = Object.freeze({
	description: "Implements exactly one task from the task list",
	mode: "subagent",
	maxSteps: 30,
	prompt:
		"You are oc-implementer. Implement exactly ONE task from the task list. Write production code and tests. Create a feature branch, commit with a descriptive message, and push. Write a brief completion report to the artifact path including: files changed, tests added, and any deviations from the task spec.",
	permission: {
		edit: "allow",
		bash: "allow",
	} as const,
});
