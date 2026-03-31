import type { AgentConfig } from "@opencode-ai/sdk";

export const ocChallengerAgent: Readonly<AgentConfig> = Object.freeze({
	description: "Proposes enhancements the user did not articulate",
	mode: "subagent",
	maxSteps: 20,
	prompt:
		"You are oc-challenger. Read the research report and original idea, then propose up to 3 enhancements the user probably wants but did not articulate. For each enhancement: name it, explain user value, estimate complexity (LOW/MEDIUM/HIGH). Write an ambitious brief to the artifact path. Cap at 3 additions maximum. Log accept/reject rationale for each.",
	permission: {
		edit: "allow",
	},
});
