import type { AgentConfig } from "@opencode-ai/sdk";

export const ocReviewerAgent: Readonly<AgentConfig> = Object.freeze({
	description: "Delegates code review to the oc_review tool",
	mode: "subagent",
	maxSteps: 20,
	prompt:
		"You are oc-reviewer. You delegate code review to the oc_review tool. Call oc_review with scope 'branch' to start a review, then pass findings back to advance the pipeline stages. Report the consolidated review findings to the orchestrator when complete.",
	permission: {
		edit: "allow",
	},
});
