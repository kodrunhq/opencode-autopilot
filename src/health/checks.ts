import { access } from "node:fs/promises";
import type { Config } from "@opencode-ai/plugin";
import { loadConfig } from "../config";
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
				repaired: false,
			});
		}
		return Object.freeze({
			name: "config-validity",
			status: "pass" as const,
			message: `Config v${config.version} loaded and valid`,
			repaired: false,
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		return Object.freeze({
			name: "config-validity",
			status: "fail" as const,
			message: `Config validation failed: ${msg}`,
			repaired: false,
		});
	}
}

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
			repaired: false,
		});
	}

	// Standard agents (5) + pipeline agents (10) = 15 expected
	const expectedAgents = [
		"researcher",
		"metaprompter",
		"documenter",
		"pr-reviewer",
		"autopilot",
		"oc-researcher",
		"oc-challenger",
		"oc-architect",
		"oc-critic",
		"oc-explorer",
		"oc-planner",
		"oc-implementer",
		"oc-reviewer",
		"oc-shipper",
		"oc-retrospector",
	];

	const agentMap = config.agent;
	const missing = expectedAgents.filter((name) => !(name in agentMap));

	if (missing.length > 0) {
		return Object.freeze({
			name: "agent-injection",
			status: "fail" as const,
			message: `${missing.length} agent(s) missing: ${missing.join(", ")}`,
			repaired: false,
			details: Object.freeze(missing),
		});
	}

	return Object.freeze({
		name: "agent-injection",
		status: "pass" as const,
		message: `All ${expectedAgents.length} agents injected`,
		repaired: false,
	});
}

/**
 * Check that the target asset directory exists and is accessible.
 */
export async function assetHealthCheck(
	_assetsDir?: string,
	targetDir?: string,
): Promise<HealthResult> {
	const target = targetDir ?? (await import("../utils/paths")).getGlobalConfigDir();

	try {
		await access(target);
		return Object.freeze({
			name: "asset-directories",
			status: "pass" as const,
			message: `Asset target directory exists: ${target}`,
			repaired: false,
		});
	} catch {
		return Object.freeze({
			name: "asset-directories",
			status: "fail" as const,
			message: `Asset target directory missing: ${target}`,
			repaired: false,
		});
	}
}
