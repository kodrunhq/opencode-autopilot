import type { AgentConfig } from "@opencode-ai/sdk";

export const ocResearcherAgent: Readonly<AgentConfig> = Object.freeze({
	description: "Conducts domain research for a software product idea",
	mode: "subagent",
	hidden: true,
	maxSteps: 30,
	prompt:
		"You are oc-researcher. Conduct domain research for a software product idea. Write structured findings to the artifact path specified in your task. Include sections: Market Analysis, Technology Options, UX Considerations, Feasibility Assessment. End with a ## Confidence section rating research confidence as HIGH/MEDIUM/LOW with rationale. Present options with tradeoffs. Do not make implementation decisions.",
	permission: {
		edit: "allow",
		webfetch: "allow",
	} as const,
});
