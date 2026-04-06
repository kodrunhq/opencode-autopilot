/**
 * Runtime skill injection for top-level agents via system.transform hook.
 *
 * Pipeline agents get skills injected through the orchestrator dispatch path.
 * Top-level agents (coder, planner, reviewer, debugger, security-auditor)
 * previously had skills hardcoded inline. This module injects skills at
 * runtime by detecting the active agent from its prompt prefix and loading
 * the required skills via the adaptive injection system.
 */

import { join } from "node:path";
import { AGENT_SKILL_MAP, detectAgentFromPrompt } from "../agents/agent-skill-map";
import { getLogger } from "../logging/domains";
import { buildMultiSkillContext } from "./adaptive-injector";
import type { LoadedSkill } from "./loader";
import { loadAllSkills } from "./loader";

const logger = getLogger("skills", "agent-injector");

const AGENT_SKILL_TOKEN_BUDGET = 6000;

type TransformInput = {
	readonly sessionID?: string;
	readonly agent?: string;
};

type TransformOutput = {
	system: string[];
};

/**
 * Create a cached skill injector for the system.transform hook.
 *
 * Loads all skills once on first invocation, then reuses the cache.
 * On each call, detects the active agent from the system prompt prefix,
 * looks up required skills in AGENT_SKILL_MAP, filters to only those
 * skills, and appends them to the system prompt.
 */
export function createAgentSkillInjector(options: {
	readonly baseDir: string;
}): (input: TransformInput, output: TransformOutput) => Promise<void> {
	let skillCache: ReadonlyMap<string, LoadedSkill> | null = null;
	let cachePromise: Promise<ReadonlyMap<string, LoadedSkill>> | null = null;

	async function getSkills(): Promise<ReadonlyMap<string, LoadedSkill>> {
		if (skillCache) return skillCache;

		if (!cachePromise) {
			cachePromise = loadAllSkills(join(options.baseDir, "skills")).then((skills) => {
				skillCache = skills;
				return skills;
			});
		}

		return cachePromise;
	}

	return async (_input: TransformInput, output: TransformOutput) => {
		try {
			const systemText = output.system.join("\n");
			const agentName = detectAgentFromPrompt(systemText);
			if (!agentName) return;

			const requiredSkills = AGENT_SKILL_MAP[agentName];
			if (!requiredSkills || requiredSkills.length === 0) return;

			const allSkills = await getSkills();
			if (allSkills.size === 0) return;

			const requiredSet = new Set(requiredSkills);
			const filtered = new Map<string, LoadedSkill>();
			for (const [name, skill] of allSkills) {
				if (requiredSet.has(name)) {
					filtered.set(name, skill);
				}
			}

			if (filtered.size === 0) return;

			const context = buildMultiSkillContext(filtered, AGENT_SKILL_TOKEN_BUDGET, "full", false);
			if (context) {
				output.system.push(context);
			}
		} catch (error: unknown) {
			logger.warn("agent skill injection failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};
}
