import { access } from "node:fs/promises";
import type { Config } from "@opencode-ai/plugin";
import { loadConfig } from "../config";
import { AGENT_NAMES } from "../orchestrator/handlers/types";
import { getAssetsDir, getGlobalConfigDir } from "../utils/paths";
import type { HealthResult } from "./types";

/**
 * Check that the plugin config file exists and passes Zod validation.
 * loadConfig returns null when the file is missing, and throws on invalid JSON/schema.
 */
export async function configHealthCheck(configPath?: string): Promise<HealthResult> {
	try {
		const config = await loadConfig(configPath);
		if (config === null) {
			return Object.freeze({
				name: "config-validity",
				status: "fail" as const,
				message: "Plugin config file not found",
			});
		}
		return Object.freeze({
			name: "config-validity",
			status: "pass" as const,
			message: `Config v${config.version} loaded and valid`,
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		return Object.freeze({
			name: "config-validity",
			status: "fail" as const,
			message: `Config validation failed: ${msg}`,
		});
	}
}

/** Standard agent names, derived from the agents barrel export. */
const STANDARD_AGENT_NAMES: readonly string[] = Object.freeze([
	"researcher",
	"metaprompter",
	"documenter",
	"pr-reviewer",
	"autopilot",
]);

/** Pipeline agent names, derived from AGENT_NAMES in the orchestrator. */
const PIPELINE_AGENT_NAMES: readonly string[] = Object.freeze(Object.values(AGENT_NAMES));

/** All expected agent names (standard + pipeline). */
const EXPECTED_AGENTS: readonly string[] = Object.freeze([
	...STANDARD_AGENT_NAMES,
	...PIPELINE_AGENT_NAMES,
]);

/**
 * Check that all expected agents are injected into the OpenCode config.
 * Requires the OpenCode config object (from the config hook).
 */
export async function agentHealthCheck(config: Config | null): Promise<HealthResult> {
	if (!config?.agent) {
		return Object.freeze({
			name: "agent-injection",
			status: "fail" as const,
			message: "No OpenCode config or agent map available",
		});
	}

	const agentMap = config.agent;
	const missing = EXPECTED_AGENTS.filter((name) => !(name in agentMap));

	if (missing.length > 0) {
		return Object.freeze({
			name: "agent-injection",
			status: "fail" as const,
			message: `${missing.length} agent(s) missing: ${missing.join(", ")}`,
			details: Object.freeze(missing),
		});
	}

	return Object.freeze({
		name: "agent-injection",
		status: "pass" as const,
		message: `All ${EXPECTED_AGENTS.length} agents injected`,
	});
}

/**
 * Check that the source and target asset directories exist and are accessible.
 */
export async function assetHealthCheck(
	assetsDir?: string,
	targetDir?: string,
): Promise<HealthResult> {
	const source = assetsDir ?? getAssetsDir();
	const target = targetDir ?? getGlobalConfigDir();

	try {
		await access(source);
	} catch (error: unknown) {
		const code = (error as NodeJS.ErrnoException).code;
		const detail = code === "ENOENT" ? "missing" : `inaccessible (${code})`;
		return Object.freeze({
			name: "asset-directories",
			status: "fail" as const,
			message: `Asset source directory ${detail}: ${source}`,
		});
	}

	try {
		await access(target);
		return Object.freeze({
			name: "asset-directories",
			status: "pass" as const,
			message: `Asset directories exist: source=${source}, target=${target}`,
		});
	} catch (error: unknown) {
		const code = (error as NodeJS.ErrnoException).code;
		const detail = code === "ENOENT" ? "missing" : `inaccessible (${code})`;
		return Object.freeze({
			name: "asset-directories",
			status: "fail" as const,
			message: `Asset target directory ${detail}: ${target}`,
		});
	}
}
