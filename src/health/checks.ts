import { Database } from "bun:sqlite";
import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "@opencode-ai/plugin";
import { parse } from "yaml";
import { loadConfig } from "../config";
import { AGENT_NAMES } from "../orchestrator/handlers/types";
import { detectProjectStackTags, filterSkillsByStack } from "../skills/adaptive-injector";
import { loadAllSkills } from "../skills/loader";
import {
	getAssetsDir,
	getAutopilotDbPath,
	getGlobalConfigDir,
	getLegacyMemoryDbPath,
} from "../utils/paths";
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

const LATEST_CONFIG_VERSION = 6;

export async function configVersionCheck(configPath?: string): Promise<HealthResult> {
	try {
		const config = await loadConfig(configPath);
		if (config === null) {
			return Object.freeze({
				name: "config-version",
				status: "fail" as const,
				message: "Config file not found",
			});
		}
		if (config.version < LATEST_CONFIG_VERSION) {
			return Object.freeze({
				name: "config-version",
				status: "warn" as const,
				message: `Config v${config.version} is outdated (latest: v${LATEST_CONFIG_VERSION}). Auto-migration will upgrade on next load.`,
			});
		}
		return Object.freeze({
			name: "config-version",
			status: "pass" as const,
			message: `Config is on latest version (v${config.version})`,
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		return Object.freeze({
			name: "config-version",
			status: "fail" as const,
			message: `Config version check failed: ${msg}`,
		});
	}
}

const REQUIRED_GROUPS: readonly string[] = Object.freeze([
	"architects",
	"challengers",
	"builders",
	"reviewers",
	"red-team",
	"researchers",
	"communicators",
	"utilities",
]);

export async function configGroupsCheck(configPath?: string): Promise<HealthResult> {
	try {
		const config = await loadConfig(configPath);
		if (config === null) {
			return Object.freeze({
				name: "config-groups",
				status: "fail" as const,
				message: "Config file not found",
			});
		}

		const assignedGroups = Object.keys(config.groups);
		const missingGroups = REQUIRED_GROUPS.filter((g) => !assignedGroups.includes(g));

		if (missingGroups.length > 0) {
			return Object.freeze({
				name: "config-groups",
				status: "warn" as const,
				message: `Missing model assignments for groups: ${missingGroups.join(", ")}`,
				details: Object.freeze(missingGroups),
			});
		}

		const groupsWithoutPrimary = assignedGroups.filter((g) => {
			const group = config.groups[g];
			return !group || !group.primary;
		});

		if (groupsWithoutPrimary.length > 0) {
			return Object.freeze({
				name: "config-groups",
				status: "warn" as const,
				message: `Groups without primary model: ${groupsWithoutPrimary.join(", ")}`,
				details: Object.freeze(groupsWithoutPrimary),
			});
		}

		return Object.freeze({
			name: "config-groups",
			status: "pass" as const,
			message: `All ${REQUIRED_GROUPS.length} required groups have primary models assigned`,
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		return Object.freeze({
			name: "config-groups",
			status: "fail" as const,
			message: `Config groups check failed: ${msg}`,
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
 * Check that OpenCode native plan/build agents are suppressed by the plugin.
 * Contract: both entries must have disable=true, mode=subagent, hidden=true.
 */
export async function nativeAgentSuppressionHealthCheck(
	config: Config | null,
): Promise<HealthResult> {
	if (!config?.agent) {
		return Object.freeze({
			name: "native-agent-suppression",
			status: "fail" as const,
			message: "No OpenCode config or agent map available",
		});
	}

	const agentMap = config.agent as Record<string, unknown>;
	const issues: string[] = [];
	const requiredKeys = ["plan", "build"] as const;
	const optionalKeys = ["Plan", "Build", "Planner", "Builder"] as const;

	for (const key of requiredKeys) {
		const raw = agentMap[key];
		if (raw === undefined) {
			issues.push(`${key}: missing config entry`);
			continue;
		}
		if (typeof raw !== "object" || raw === null) {
			issues.push(`${key}: invalid config entry type`);
			continue;
		}

		const entry = raw as Record<string, unknown>;
		if (entry.disable !== true) {
			issues.push(`${key}: disable must be true`);
		}
		if (entry.mode !== "subagent") {
			issues.push(`${key}: mode must be subagent`);
		}
		if (entry.hidden !== true) {
			issues.push(`${key}: hidden must be true`);
		}
	}

	for (const key of optionalKeys) {
		const raw = agentMap[key];
		if (raw === undefined) continue;
		if (typeof raw !== "object" || raw === null) {
			issues.push(`${key}: invalid config entry type`);
			continue;
		}

		const entry = raw as Record<string, unknown>;
		if (entry.disable !== true) {
			issues.push(`${key}: disable must be true`);
		}
		if (entry.mode !== "subagent") {
			issues.push(`${key}: mode must be subagent`);
		}
		if (entry.hidden !== true) {
			issues.push(`${key}: hidden must be true`);
		}
	}

	if (issues.length > 0) {
		return Object.freeze({
			name: "native-agent-suppression",
			status: "fail" as const,
			message: `${issues.length} native suppression issue(s) found`,
			details: Object.freeze([...issues]),
		});
	}

	return Object.freeze({
		name: "native-agent-suppression",
		status: "pass" as const,
		message: "Native plan/build agents are suppressed",
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

/**
 * Check skill loading status per detected project stack.
 * Reports which stacks are detected and how many skills match.
 * Accepts optional skillsDir for testability (defaults to global config skills dir).
 */
export async function skillHealthCheck(
	projectRoot: string,
	skillsDir?: string,
): Promise<HealthResult> {
	try {
		const tags = await detectProjectStackTags(projectRoot);
		const resolvedSkillsDir = skillsDir ?? join(getGlobalConfigDir(), "skills");
		const allSkills = await loadAllSkills(resolvedSkillsDir);
		const filtered = filterSkillsByStack(allSkills, tags);

		const stackLabel = tags.length > 0 ? tags.join(", ") : "none";
		return Object.freeze({
			name: "skill-loading",
			status: "pass" as const,
			message: `Detected stacks: [${stackLabel}], ${filtered.size}/${allSkills.size} skills matched`,
			details: Object.freeze([...filtered.keys()]),
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		return Object.freeze({
			name: "skill-loading",
			status: "fail" as const,
			message: `Skill check failed: ${msg}`,
		});
	}
}

/**
 * Check memory DB health: existence, readability, observation count.
 * Does NOT call getMemoryDb() to avoid creating an empty DB as a side effect.
 * Uses readonly DB access for safe inspection.
 * Accepts optional baseDir for testability (defaults to global config dir).
 */
export async function memoryHealthCheck(baseDir?: string): Promise<HealthResult> {
	const resolvedBase = baseDir ?? getGlobalConfigDir();
	const dbPath = getAutopilotDbPath(resolvedBase);
	const legacyDbPath = getLegacyMemoryDbPath(resolvedBase);

	try {
		await access(dbPath);
	} catch (error: unknown) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ENOENT") {
			try {
				await access(legacyDbPath);
			} catch (legacyError: unknown) {
				const legacyCode = (legacyError as NodeJS.ErrnoException).code;
				if (legacyCode === "ENOENT") {
					return Object.freeze({
						name: "memory-db",
						status: "pass" as const,
						message: `Memory DB not yet initialized -- will be created on first memory capture`,
					});
				}
				const legacyMsg = legacyError instanceof Error ? legacyError.message : String(legacyError);
				return Object.freeze({
					name: "memory-db",
					status: "fail" as const,
					message: `Memory DB inaccessible: ${legacyMsg}`,
				});
			}

			return Object.freeze({
				name: "memory-db",
				status: "pass" as const,
				message: `Legacy memory DB found -- unified DB will be created on next write`,
			});
		}

		const msg = error instanceof Error ? error.message : String(error);
		return Object.freeze({
			name: "memory-db",
			status: "fail" as const,
			message: `Memory DB inaccessible: ${msg}`,
		});
	}

	try {
		const fileStat = await stat(dbPath);
		const sizeKB = (fileStat.size / 1024).toFixed(1);

		if (fileStat.size === 0) {
			return Object.freeze({
				name: "memory-db",
				status: "fail" as const,
				message: `Memory DB exists but is empty (0 bytes)`,
			});
		}

		const db = new Database(dbPath, { readonly: true });
		try {
			const row = db.query("SELECT COUNT(*) as count FROM observations").get() as {
				count: number;
			} | null;
			const count = row?.count ?? 0;
			return Object.freeze({
				name: "memory-db",
				status: "pass" as const,
				message: `Memory DB exists (${count} observation${count !== 1 ? "s" : ""}, ${sizeKB}KB)`,
			});
		} finally {
			db.close();
		}
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		return Object.freeze({
			name: "memory-db",
			status: "fail" as const,
			message: `Memory DB read error: ${msg}`,
		});
	}
}

/** Expected command files that should exist in the commands directory. */
const EXPECTED_COMMANDS: readonly string[] = Object.freeze([
	"oc-tdd",
	"oc-review-pr",
	"oc-brainstorm",
	"oc-write-plan",
	"oc-stocktake",
	"oc-update-docs",
	"oc-new-agent",
	"oc-new-skill",
	"oc-new-command",
	"oc-quick",
	"oc-review-agents",
]);

/**
 * Check command accessibility: file existence and valid YAML frontmatter.
 * Verifies each expected command file exists and has a non-empty description.
 */
export async function commandHealthCheck(targetDir?: string): Promise<HealthResult> {
	const dir = targetDir ?? getGlobalConfigDir();
	const missing: string[] = [];
	const invalid: string[] = [];

	await Promise.all(
		EXPECTED_COMMANDS.map(async (name) => {
			const filePath = join(dir, "commands", `${name}.md`);
			try {
				const content = await readFile(filePath, "utf-8");
				const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
				if (!fmMatch) {
					invalid.push(`${name}: no frontmatter`);
					return;
				}
				try {
					const parsed = parse(fmMatch[1]);
					if (
						parsed === null ||
						typeof parsed !== "object" ||
						typeof parsed.description !== "string" ||
						parsed.description.trim().length === 0
					) {
						invalid.push(`${name}: missing or empty description`);
					}
				} catch {
					invalid.push(`${name}: invalid YAML frontmatter`);
				}
			} catch (error: unknown) {
				const code = (error as NodeJS.ErrnoException).code;
				if (code === "ENOENT") {
					missing.push(name);
				} else {
					invalid.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}),
	);

	missing.sort();
	invalid.sort();
	const issues = [...missing.map((n) => `missing: ${n}`), ...invalid];

	if (issues.length === 0) {
		return Object.freeze({
			name: "command-accessibility",
			status: "pass" as const,
			message: `All ${EXPECTED_COMMANDS.length} commands accessible`,
		});
	}

	return Object.freeze({
		name: "command-accessibility",
		status: "fail" as const,
		message: `${issues.length} command issue(s) found`,
		details: Object.freeze(issues),
	});
}
