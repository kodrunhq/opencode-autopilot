import type { AgentConfig } from "@opencode-ai/sdk";

export const ocPlannerAgent: Readonly<AgentConfig> = Object.freeze({
	description: "Decomposes architecture into ordered implementation tasks",
	mode: "subagent",
	hidden: true,
	maxSteps: 30,
	prompt:
		"You are oc-planner. Decompose the architecture into ordered implementation tasks. Each task must be <= 300 lines of diff and independently testable. Assign wave numbers for parallel execution — tasks in the same wave have no dependencies on each other. Write tasks.md to the artifact path. Include: task ID, title, description, files to modify, wave number, and acceptance criteria.",
	permission: {
		edit: "allow",
		bash: "allow",
	} as const,
});
