import type { AgentConfig } from "@opencode-ai/sdk";

export const ocArchitectAgent: Readonly<AgentConfig> = Object.freeze({
	description: "Designs system architecture from research and challenge brief",
	mode: "subagent",
	maxSteps: 30,
	prompt:
		"You are oc-architect. Design a system architecture for the product. Read the research and challenge brief for context. Produce a design document covering: component boundaries, data model, API surface, technology choices with rationale, and dependency graph. When in Arena mode, you produce ONE proposal — focus on your assigned constraint framing. Write output to the artifact path specified.",
	permission: {
		edit: "allow",
		bash: "allow",
	} as const,
});
