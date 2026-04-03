import type { Config } from "@opencode-ai/plugin";
import { loadConfig } from "../config";
import { resolveModelForAgent } from "../registry/resolver";
import type { AgentOverride, GroupModelAssignment } from "../registry/types";
import { autopilotAgent } from "./autopilot";
import { documenterAgent } from "./documenter";
import { metaprompterAgent } from "./metaprompter";
import { pipelineAgents } from "./pipeline/index";
import { prReviewerAgent } from "./pr-reviewer";
import { researcherAgent } from "./researcher";

interface AgentConfig {
	readonly [key: string]: unknown;
	readonly permission?: Record<string, unknown>;
}

export const agents = {
	researcher: researcherAgent,
	metaprompter: metaprompterAgent,
	documenter: documenterAgent,
	"pr-reviewer": prReviewerAgent,
	autopilot: autopilotAgent,
} as const;

/**
 * Register a set of agents into the OpenCode config, resolving model
 * assignments from groups/overrides. Skips agents already defined
 * to preserve user customizations.
 *
 * Mutation of config.agent is intentional: the OpenCode plugin configHook
 * API requires mutating the provided Config object to register agents.
 */
function registerAgents(
	agentMap: Readonly<Record<string, Readonly<AgentConfig>>>,
	config: Config,
	groups: Readonly<Record<string, GroupModelAssignment>>,
	overrides: Readonly<Record<string, AgentOverride>>,
): void {
	for (const [name, agentConfig] of Object.entries(agentMap)) {
		if (config.agent![name] === undefined) {
			// Deep-copy agent config including nested permission to avoid shared references.
			const resolved = resolveModelForAgent(name, groups, overrides);
			config.agent![name] = {
				...agentConfig,
				...(agentConfig.permission && { permission: { ...agentConfig.permission } }),
				...(resolved && { model: resolved.primary }),
				...(resolved &&
					resolved.fallbacks.length > 0 && {
						fallback_models: [...resolved.fallbacks],
					}),
			};
		}
	}
}

export async function configHook(config: Config, configPath?: string): Promise<void> {
	if (!config.agent) {
		config.agent = {};
	}

	// Load plugin config for model group resolution
	let pluginConfig = null;
	try {
		pluginConfig = await loadConfig(configPath);
	} catch (error: unknown) {
		console.error(
			"[opencode-autopilot] Failed to load plugin config:",
			error instanceof Error ? error.message : String(error),
		);
	}
	const groups: Readonly<Record<string, GroupModelAssignment>> = pluginConfig?.groups ?? {};
	const overrides: Readonly<Record<string, AgentOverride>> = pluginConfig?.overrides ?? {};

	// Register standard agents and pipeline agents (v2 orchestrator subagents)
	registerAgents(agents, config, groups, overrides);
	registerAgents(pipelineAgents, config, groups, overrides);
}

export { autopilotAgent } from "./autopilot";
export { documenterAgent } from "./documenter";
export { metaprompterAgent } from "./metaprompter";
export { prReviewerAgent } from "./pr-reviewer";
export { researcherAgent } from "./researcher";
