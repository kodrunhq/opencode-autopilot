#!/usr/bin/env bun

import { execFile as execFileCb } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import {
	CONFIG_PATH,
	createDefaultConfig,
	inspectConfigMode,
	loadConfig,
	saveConfig,
} from "../src/config";
import { diagnose } from "../src/registry/doctor";
import { ALL_GROUP_IDS, DIVERSITY_RULES, GROUP_DEFINITIONS } from "../src/registry/model-groups";
import type { GroupId } from "../src/registry/types";
import { fileExists } from "../src/utils/fs-helpers";
import {
	getInstallTargetPath,
	parseJsonc,
	type ResolvedConfig,
	resolveOpenCodeConfig,
	verifyPluginLoad,
} from "../src/utils/opencode-config";
import { inspectProjectArtifactState } from "../src/utils/paths";
import { runConfigure } from "./configure-tui";
import { runInspect } from "./inspect";

const execFile = promisify(execFileCb);

// ── ANSI color helpers (zero dependencies) ──────────────────────────

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

export interface CliOptions {
	readonly cwd?: string;
	readonly noTui?: boolean;
	readonly configDir?: string;
}

const PLUGIN_NAME = "@kodrunhq/opencode-autopilot";

// ── Helpers ─────────────────────────────────────────────────────────

async function checkOpenCodeInstalled(): Promise<{ version: string | null; error?: string }> {
	try {
		const { stdout } = await execFile("opencode", ["--version"]);
		return { version: stdout.trim() };
	} catch (error: unknown) {
		const err = error as Error & { code?: string; stderr?: string };
		if (err.code === "ENOENT") {
			return { version: null };
		}
		const errorMsg = err.stderr || err.message || "Unknown error";
		return { version: null, error: errorMsg };
	}
}

// ── runInstall ──────────────────────────────────────────────────────

export async function runInstall(options: CliOptions = {}): Promise<void> {
	const cwd = options.cwd ?? process.cwd();
	const configPath = options.configDir ?? CONFIG_PATH;

	console.log("");
	console.log(bold("opencode-autopilot install"));
	console.log("─────────────────────────");
	console.log("");

	const checkResult = await checkOpenCodeInstalled();
	if (checkResult.version) {
		console.log(`  ${green("✓")} OpenCode installed: ${checkResult.version}`);
	} else if (checkResult.error) {
		console.log(`  ${red("✗")} OpenCode found but not working`);
		console.log(`    ${checkResult.error}`);
	} else {
		console.log(`  ${yellow("⚠")} OpenCode not found — install from https://opencode.ai`);
	}

	const resolvedConfig = await resolveOpenCodeConfig({ cwd });
	let jsonPath: string;
	let opencodeJson: { plugin?: string[]; [key: string]: unknown };
	let location: string;

	if (resolvedConfig.exists && resolvedConfig.content) {
		jsonPath = resolvedConfig.path;
		opencodeJson = resolvedConfig.content as typeof opencodeJson;
		location = resolvedConfig.location;
		console.log(`  ${green("✓")} Found ${location} config: ${jsonPath}`);
	} else if (resolvedConfig.exists) {
		jsonPath = resolvedConfig.path;
		try {
			const raw = await readFile(jsonPath, "utf-8");
			opencodeJson = parseJsonc(raw) as typeof opencodeJson;
			location = resolvedConfig.location;
			console.log(`  ${green("✓")} Found ${location} config: ${jsonPath}`);
		} catch {
			console.error(
				`  ${red("✗")} Config file contains invalid JSON/JSONC. Please fix it and try again.`,
			);
			process.exit(1);
		}
	} else {
		// No existing config - determine where to create it
		// Priority: OPENCODE_CONFIG env var > OPENCODE_CONFIG_DIR env var > git root > global
		const envConfigPath = process.env.OPENCODE_CONFIG;
		const envConfigDir = process.env.OPENCODE_CONFIG_DIR;

		if (envConfigPath) {
			// OPENCODE_CONFIG env var is set - create at that exact path
			jsonPath = envConfigPath;
			location = "env-exact";
		} else if (envConfigDir) {
			// OPENCODE_CONFIG_DIR env var is set - create in that directory
			jsonPath = join(envConfigDir, ".opencode.json");
			location = "env-dir";
		} else {
			// No env vars - use git root or global
			jsonPath = await getInstallTargetPath(cwd);
			location = jsonPath.includes(".config/opencode") ? "global" : "project";
		}
		opencodeJson = { plugin: [] };
		console.log(`  ${green("✓")} Will create ${location} config: ${jsonPath}`);
	}

	const existingPlugins: string[] = Array.isArray(opencodeJson.plugin) ? opencodeJson.plugin : [];

	if (existingPlugins.includes(PLUGIN_NAME)) {
		console.log(`  ${green("✓")} Plugin already registered`);
	} else {
		opencodeJson = {
			...opencodeJson,
			plugin: [...existingPlugins, PLUGIN_NAME],
		};
		const tmpJsonPath = `${jsonPath}.tmp.${randomBytes(8).toString("hex")}`;
		await mkdir(dirname(jsonPath), { recursive: true });
		await writeFile(tmpJsonPath, JSON.stringify(opencodeJson, null, 2), "utf-8");
		await rename(tmpJsonPath, jsonPath);
		console.log(`  ${green("✓")} Plugin registered in ${location} config`);
	}

	if (await fileExists(configPath)) {
		const config = await loadConfig(configPath);
		if (config?.configured) {
			console.log(`  ${green("✓")} Config already configured`);
		} else {
			console.log(`  ${yellow("⚠")} Config exists, not yet configured`);
		}
	} else {
		const defaultConfig = createDefaultConfig();
		await saveConfig(defaultConfig, configPath);
		console.log(`  ${green("✓")} Created starter config`);
	}

	console.log("");
	console.log(bold("Next steps:"));
	console.log("");
	console.log("  Run the interactive configuration wizard:");
	console.log("");
	console.log(`    ${bold("bunx @kodrunhq/opencode-autopilot configure")}`);
	console.log("");
	console.log("  This walks through each agent group with searchable model");
	console.log("  selection and fallback configuration.");
	console.log("");
}

// ── runDoctor helpers ──────────────────────────────────────────────

async function printSystemChecks(
	cwd: string,
	configPath: string,
): Promise<{
	hasFailure: boolean;
	config: Awaited<ReturnType<typeof loadConfig>>;
	resolvedOpenCodeConfig: ResolvedConfig;
}> {
	let hasFailure = false;

	console.log(bold("System"));

	const checkResult = await checkOpenCodeInstalled();
	if (checkResult.version) {
		console.log(`  OpenCode installed      ${green("✓")} ${checkResult.version}`);
	} else if (checkResult.error) {
		console.log(`  OpenCode installed      ${red("✗")} found but not working`);
		console.log(`    ${checkResult.error}`);
		hasFailure = true;
	} else {
		console.log(
			`  OpenCode installed      ${red("✗")} not found — install from https://opencode.ai`,
		);
		hasFailure = true;
	}

	const resolvedConfig = await resolveOpenCodeConfig({ cwd });

	if (resolvedConfig.exists && resolvedConfig.content) {
		const parsed = resolvedConfig.content as { plugin?: string[] };
		if (Array.isArray(parsed.plugin) && parsed.plugin.includes(PLUGIN_NAME)) {
			console.log(`  Plugin registered       ${green("✓")} ${resolvedConfig.location} config`);
		} else {
			console.log(`  Plugin registered       ${red("✗")} not in config — run install`);
			hasFailure = true;
		}
	} else if (resolvedConfig.exists) {
		console.log(`  Plugin registered       ${red("✗")} invalid config — fix JSON/JSONC syntax`);
		hasFailure = true;
	} else {
		console.log(`  Plugin registered       ${red("✗")} no config found — run install`);
		hasFailure = true;
	}

	const config = await loadConfig(configPath);
	if (config) {
		console.log(`  Config file             ${green("✓")} found`);
		console.log(`  Config schema           ${green("✓")} v${config.version}`);
	} else {
		console.log(`  Config file             ${red("✗")} not found — run install`);
		hasFailure = true;
	}

	if (config) {
		if (config.configured) {
			console.log(`  Setup completed         ${green("✓")} configured: true`);
		} else {
			console.log(
				`  Setup completed         ${red("✗")} configured: false — run bunx @kodrunhq/opencode-autopilot configure`,
			);
			hasFailure = true;
		}
	}

	return { hasFailure, config, resolvedOpenCodeConfig: resolvedConfig };
}

function printModelAssignments(result: ReturnType<typeof diagnose>): void {
	console.log("");
	console.log(bold("Model Assignments"));

	if (result.configExists) {
		for (const groupId of ALL_GROUP_IDS) {
			const def = GROUP_DEFINITIONS[groupId];
			const info = result.groupsAssigned[groupId];
			const label = def.label.padEnd(20);

			if (info?.assigned && info.primary) {
				const fallbackStr = info.fallbacks.length > 0 ? ` -> ${info.fallbacks.join(", ")}` : "";
				console.log(`  ${label}  ${info.primary}${fallbackStr}`);
			} else {
				console.log(`  ${label}  ${red("✗")} not assigned`);
			}
		}
	} else {
		console.log(`  ${red("✗")} no config loaded`);
	}
}

function printDiversityResults(
	result: ReturnType<typeof diagnose>,
	config: Awaited<ReturnType<typeof loadConfig>>,
): void {
	console.log("");
	console.log(bold("Adversarial Diversity"));

	if (config && Object.keys(config.groups).length > 0) {
		// Derive display rules from DIVERSITY_RULES
		const rules = DIVERSITY_RULES.map((rule) => {
			const groupLabels = rule.groups.map((g) => GROUP_DEFINITIONS[g as GroupId].label);
			const label =
				groupLabels.length === 2
					? `${groupLabels[0]} <-> ${groupLabels[1]}`
					: `${groupLabels[0]} <-> ${groupLabels.slice(1).join("+")}`;
			return { label, groups: rule.groups };
		});

		for (const rule of rules) {
			const key = [...rule.groups].sort().join(",");
			const allAssigned = rule.groups.every((g) => config.groups[g]);

			if (!allAssigned) {
				console.log(`  ${rule.label.padEnd(28)} ${yellow("⚠")} groups not fully assigned`);
				continue;
			}

			const warning = result.diversityWarnings.find((w) => [...w.groups].sort().join(",") === key);

			if (warning) {
				console.log(
					`  ${rule.label.padEnd(28)} ${yellow("⚠")} shared family: ${warning.sharedFamily} — consider different families`,
				);
			} else {
				console.log(`  ${rule.label.padEnd(28)} ${green("✓")} different families`);
			}
		}
	} else {
		console.log(`  ${yellow("⚠")} no model assignments to check`);
	}
}

function printProjectPreflight(
	projectRoot: string,
	config: Awaited<ReturnType<typeof loadConfig>>,
): boolean {
	console.log("");
	console.log(bold("Project Preflight"));

	let hasFailure = false;
	const artifactState = inspectProjectArtifactState(projectRoot);
	const configAnalysis = config ? inspectConfigMode(config, { projectRoot }) : null;

	if (configAnalysis) {
		console.log(
			`  Canonical mode          ${configAnalysis.mode.interactionMode}/${configAnalysis.mode.executionMode}/${configAnalysis.mode.visibilityMode}/${configAnalysis.mode.verificationMode}`,
		);
		console.log(
			`  Verification profile    ${configAnalysis.verificationProfileConfigured ? green("✓") : yellow("⚠")} ${configAnalysis.verificationProfileConfigured ? "configured" : "missing"}`,
		);
	}

	if (artifactState.issues.length === 0 && (configAnalysis?.issues.length ?? 0) === 0) {
		console.log(`  Artifact boundary       ${green("✓")} clean`);
		return false;
	}

	for (const issue of artifactState.issues) {
		const icon = issue.severity === "error" ? red("✗") : yellow("⚠");
		console.log(`  Artifact boundary       ${icon} ${issue.message}`);
		for (const filePath of issue.paths) {
			console.log(`    ${filePath}`);
		}
		if (issue.severity === "error") {
			hasFailure = true;
		}
	}

	for (const issue of configAnalysis?.issues ?? []) {
		const icon = issue.severity === "error" ? red("✗") : yellow("⚠");
		console.log(`  Mode invariants         ${icon} ${issue.message}`);
		if (issue.severity === "error") {
			hasFailure = true;
		}
	}

	return hasFailure;
}

// ── runDoctor ───────────────────────────────────────────────────────

export async function runDoctor(options: CliOptions = {}): Promise<void> {
	const cwd = options.cwd ?? process.cwd();
	const configPath = options.configDir ?? CONFIG_PATH;

	console.log("");
	console.log(bold("opencode-autopilot doctor"));
	console.log("─────────────────────────");
	console.log("");

	const { hasFailure: systemHasFailure, config } = await printSystemChecks(cwd, configPath);
	let hasFailure = systemHasFailure;

	const result = diagnose(config);

	printModelAssignments(result);
	printDiversityResults(result, config);
	hasFailure = printProjectPreflight(cwd, config) || hasFailure;

	console.log("");
	console.log(bold("Plugin Load Verification"));

	const pluginVerification = await verifyPluginLoad();
	if (pluginVerification.success) {
		// Check if this is a real verification or just CLI accessibility
		const isActuallyVerified = !pluginVerification.details?.includes("not verified");

		if (isActuallyVerified) {
			console.log(`  OpenCode CLI accessible ${green("✓")}`);
			if (pluginVerification.details) {
				console.log(`    ${pluginVerification.details}`);
			}
		} else {
			console.log(`  OpenCode CLI accessible ${yellow("⚠")}`);
			if (pluginVerification.details) {
				console.log(`    ${pluginVerification.details}`);
			}
			// This is a warning, not a failure - plugin may still work
		}
	} else {
		console.log(`  OpenCode CLI accessible ${red("✗")}`);
		console.log(`    ${pluginVerification.message}`);
		if (pluginVerification.details) {
			console.log(`    ${pluginVerification.details}`);
		}
		hasFailure = true;
	}

	console.log("");
	if (hasFailure) {
		console.log(red("Some checks failed."));
		process.exitCode = 1;
	} else {
		console.log(green("All checks passed."));
	}
	console.log("");
}

// ── Help ────────────────────────────────────────────────────────────

function printUsage(): void {
	console.log("");
	console.log(`${bold("Usage:")} opencode-autopilot <command>`);
	console.log("");
	console.log("Commands:");
	console.log("  install     Register the plugin and create starter config");
	console.log("  configure   Interactive model assignment for each agent group");
	console.log("  doctor      Check installation health and model assignments");
	console.log("  inspect     Read-only inspection of projects, runs, events, and memory");
	console.log("");
	console.log("Options:");
	console.log("  --help, -h             Show this help message");
	console.log("");
	console.log("Configure options:");
	console.log("  --group <groupId>      Configure a single agent group only");
	console.log(`                         Valid groups: ${ALL_GROUP_IDS.join(", ")}`);
	console.log("");
}

// ── CLI dispatch (only when run directly, not imported) ─────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args[0];

	switch (command) {
		case "install":
			await runInstall({ noTui: args.includes("--no-tui") });
			break;
		case "configure": {
			const groupIdx = args.indexOf("--group");
			const groupFilter =
				groupIdx >= 0 && args[groupIdx + 1]
					? (args[groupIdx + 1].split(",").map((g: string) => g.trim()) as readonly GroupId[])
					: undefined;
			await runConfigure(CONFIG_PATH, groupFilter);
			break;
		}
		case "doctor":
			await runDoctor();
			break;
		case "inspect":
			await runInspect(args.slice(1));
			break;
		case "--help":
		case "-h":
		case undefined:
			printUsage();
			break;
		default:
			console.error(`Unknown command: ${command}`);
			printUsage();
			process.exit(1);
	}
}
