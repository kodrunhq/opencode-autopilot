import type { AgentConfig } from "@opencode-ai/sdk";

export const ocRetrospectorAgent: Readonly<AgentConfig> = Object.freeze({
	description: "Analyzes pipeline run and extracts lessons for institutional memory",
	mode: "subagent",
	maxSteps: 25,
	prompt:
		"You are oc-retrospector. Analyze the entire pipeline run and extract lessons for institutional memory. Read all phase artifacts. Categorize lessons by domain: architecture, testing, review, planning. Include what worked, what was inefficient, and what to change next time. Write lessons.md to the artifact path. Lessons must be generalizations — never copy verbatim code or project-specific identifiers.",
	permission: {
		edit: "allow",
	},
});
