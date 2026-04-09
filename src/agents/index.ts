import type { Config } from "@opencode-ai/plugin";
import { loadConfig } from "../config";
import { resolveModelForAgent } from "../registry/resolver";
import type { AgentOverride, GroupModelAssignment } from "../registry/types";
import { autopilotAgent } from "./autopilot";
import { coderAgent } from "./coder";
import { debuggerAgent } from "./debugger";
import { metaprompterAgent } from "./metaprompter";
import { oracleAgent } from "./oracle";
import { pipelineAgents } from "./pipeline/index";
import { plannerAgent } from "./planner";
import { prReviewerAgent } from "./pr-reviewer";
import { researcherAgent } from "./researcher";
import { reviewerAgent } from "./reviewer";
import { securityAuditorAgent } from "./security-auditor";

interface AgentConfig {
	readonly [key: string]: unknown;
	readonly permission?: Record<string, unknown>;
}

export const agents = {
	autopilot: autopilotAgent,
	coder: coderAgent,
	debugger: debuggerAgent,
	metaprompter: metaprompterAgent,
	oracle: oracleAgent,
	"pr-reviewer": prReviewerAgent,
	"security-auditor": securityAuditorAgent,
	"specialist-planner": plannerAgent,
	"specialist-researcher": researcherAgent,
	"specialist-reviewer": reviewerAgent,
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
	const agentRef = config.agent;
	if (!agentRef) return;
	for (const [name, agentConfig] of Object.entries(agentMap)) {
		if (agentRef[name] === undefined) {
			// Deep-copy agent config including nested permission to avoid shared references.
			const resolved = resolveModelForAgent(name, groups, overrides);
			agentRef[name] = {
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

const nativeSuppressionPatch = Object.freeze({
	disable: true,
	mode: "subagent" as const,
	hidden: true,
});

const optionalNativePlanBuildKeys = Object.freeze(["Plan", "Build", "Planner", "Builder"] as const);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function mergeSuppressionPatch(entry: unknown): Record<string, unknown> {
	if (isObjectRecord(entry)) {
		return {
			...entry,
			...nativeSuppressionPatch,
		};
	}

	return { ...nativeSuppressionPatch };
}

function suppressNativePlanBuildAgents(config: Config): void {
	if (!config.agent) return;

	const agentRef = config.agent as Record<string, unknown>;

	// Deterministically suppress native lowercase keys even if OpenCode did not
	// pre-populate them before configHook execution.
	for (const key of ["plan", "build"] as const) {
		agentRef[key] = mergeSuppressionPatch(agentRef[key]);
	}

	// Also suppress optional native variants when present.
	for (const key of optionalNativePlanBuildKeys) {
		if (agentRef[key] !== undefined) {
			agentRef[key] = mergeSuppressionPatch(agentRef[key]);
		}
	}
}

function suppressLegacyModePlanBuild(config: Config): void {
	if (!config.mode) return;

	const modeRef = config.mode as Record<string, unknown>;
	for (const key of ["plan", "build", ...optionalNativePlanBuildKeys] as const) {
		const existing = modeRef[key];
		if (existing === undefined) continue;
		if (!isObjectRecord(existing)) continue;
		modeRef[key] = mergeSuppressionPatch(existing);
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

	// Suppress native built-in Plan/Build agents. This is deterministic and does
	// not rely on whether OpenCode pre-populated keys before configHook runs.
	suppressNativePlanBuildAgents(config);

	// Backward compatibility for legacy mode.plan/mode.build config shape.
	suppressLegacyModePlanBuild(config);
}

export { autopilotAgent } from "./autopilot";
export { coderAgent } from "./coder";
export { debuggerAgent } from "./debugger";
export { metaprompterAgent } from "./metaprompter";
export { oracleAgent } from "./oracle";
export { plannerAgent } from "./planner";
export { prReviewerAgent } from "./pr-reviewer";
export { researcherAgent } from "./researcher";
export { reviewerAgent } from "./reviewer";
export { securityAuditorAgent } from "./security-auditor";
