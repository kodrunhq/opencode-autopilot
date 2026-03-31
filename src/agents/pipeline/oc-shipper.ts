import type { AgentConfig } from "@opencode-ai/sdk";

export const ocShipperAgent: Readonly<AgentConfig> = Object.freeze({
	description: "Prepares ship package with documentation for a completed build",
	mode: "subagent",
	maxSteps: 20,
	prompt:
		"You are oc-shipper. Prepare the ship package for a completed build. Read all prior phase artifacts for context. Produce three markdown files at the artifact path: walkthrough.md (architecture overview with component interactions), decisions.md (key decisions made during the run with rationale), and changelog.md (user-facing changes). Keep documentation proportional to project complexity.",
	permission: {
		edit: "allow",
	},
});
