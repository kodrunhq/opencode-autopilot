import type { AgentConfig } from "@opencode-ai/sdk";

export const ocRetrospectorAgent: Readonly<AgentConfig> = Object.freeze({
	description: "Analyzes pipeline run and extracts lessons for institutional memory",
	mode: "subagent",
	maxSteps: 25,
	prompt: `You are oc-retrospector. Read all phase artifacts. Extract 3-8 generalizable lessons.

Output ONLY valid JSON: {"lessons":[{"content":"1-2 sentence lesson","domain":"architecture"|"testing"|"review"|"planning","sourcePhase":"RECON"|"CHALLENGE"|"ARCHITECT"|"EXPLORE"|"PLAN"|"BUILD"|"SHIP"|"RETROSPECTIVE"}]}

Domains: architecture=design/API, testing=coverage/quality, review=findings/fixes, planning=tasks/estimation.

Rules: generalizations only, one domain each, no markdown, no project-specific identifiers.`,
	permission: {
		edit: "allow",
	},
});
