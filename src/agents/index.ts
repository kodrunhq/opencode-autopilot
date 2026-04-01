import type { Config } from "@opencode-ai/plugin";
import { documenterAgent } from "./documenter";
import { metaprompterAgent } from "./metaprompter";
import { orchestratorAgent } from "./orchestrator";
import { pipelineAgents } from "./pipeline/index";
import { prReviewerAgent } from "./pr-reviewer";
import { researcherAgent } from "./researcher";

const agents = {
	researcher: researcherAgent,
	metaprompter: metaprompterAgent,
	documenter: documenterAgent,
	"pr-reviewer": prReviewerAgent,
	orchestrator: orchestratorAgent,
} as const;

export async function configHook(config: Config): Promise<void> {
	if (!config.agent) {
		config.agent = {};
	}
	for (const [name, agentConfig] of Object.entries(agents)) {
		// Only set if not already defined — preserve user customizations (Pitfall 2)
		if (config.agent[name] === undefined) {
			// Mutation of config.agent is intentional: the OpenCode plugin configHook
			// API requires mutating the provided Config object to register agents.
			// We deep-copy agent config including nested permission to avoid shared references.
			config.agent[name] = {
				...agentConfig,
				...(agentConfig.permission && { permission: { ...agentConfig.permission } }),
			};
		}
	}

	// Register pipeline agents (v2 orchestrator subagents)
	for (const [name, agentConfig] of Object.entries(pipelineAgents)) {
		if (config.agent[name] === undefined) {
			config.agent[name] = {
				...agentConfig,
				...(agentConfig.permission && { permission: { ...agentConfig.permission } }),
			};
		}
	}
}

export { documenterAgent } from "./documenter";
export { metaprompterAgent } from "./metaprompter";
export { orchestratorAgent } from "./orchestrator";
export { prReviewerAgent } from "./pr-reviewer";
export { researcherAgent } from "./researcher";
