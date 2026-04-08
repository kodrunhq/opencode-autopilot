#!/usr/bin/env bun

import { execFile as execFileCb } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { CONFIG_PATH, createDefaultConfig, loadConfig, saveConfig } from "../src/config";
import { diagnose } from "../src/registry/doctor";
import { ALL_GROUP_IDS, DIVERSITY_RULES, GROUP_DEFINITIONS } from "../src/registry/model-groups";
import type { GroupId } from "../src/registry/types";
import { fileExists } from "../src/utils/fs-helpers";
import { runConfigure } from "./configure-tui";
import { runInspect } from "./inspect";

const execFile = promisify(execFileCb);

// ── ANSI color helpers (zero dependencies) ──────────────────────────

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

// ── Types ───────────────────────────────────────────────────────────

export interface CliOptions {
	readonly cwd?: string;
	readonly noTui?: boolean;
	readonly configDir?: string;
}

// ── Constants ───────────────────────────────────────────────────────

const PLUGIN_NAME = "@kodrunhq/opencode-autopilot";
const OPENCODE_JSON = "opencode.json";

// ── Helpers ─────────────────────────────────────────────────────────

async function checkOpenCodeInstalled(): Promise<string | null> {
	try {
		const { stdout } = await execFile("opencode", ["--version"]);
		return stdout.trim();
	} catch (error: unknown) {
		if (
			error instanceof Error &&
			"code" in error &&
			(error as NodeJS.ErrnoException).code === "ENOENT"
		) {
			return null;
		}
		throw error;
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

	// 1. Check OpenCode installed (warn but don't fail)
	const version = await checkOpenCodeInstalled();
	if (version) {
		console.log(`  ${green("✓")} OpenCode installed: ${version}`);
	} else {
		console.log(`  ${yellow("⚠")} OpenCode not found — install from https://opencode.ai`);
	}

	// 2. Locate or create opencode.json
	const jsonPath = join(cwd, OPENCODE_JSON);
	let opencodeJson: { plugin?: string[]; [key: string]: unknown };

	if (await fileExists(jsonPath)) {
		const raw = await readFile(jsonPath, "utf-8");
		try {
			opencodeJson = JSON.parse(raw) as typeof opencodeJson;
		} catch {
			console.error(
				`  ${red("✗")} ${OPENCODE_JSON} contains invalid JSON. Please fix it and try again.`,
			);
			process.exit(1);
		}
		console.log(`  ${green("✓")} Found ${OPENCODE_JSON}`);
	} else {
		opencodeJson = { plugin: [] };
		console.log(`  ${green("✓")} Created ${OPENCODE_JSON}`);
	}

	// 3. Register plugin (idempotent)
	const existingPlugins: string[] = Array.isArray(opencodeJson.plugin) ? opencodeJson.plugin : [];

	if (existingPlugins.includes(PLUGIN_NAME)) {
		console.log(`  ${green("✓")} Plugin already registered`);
	} else {
		opencodeJson = {
			...opencodeJson,
			plugin: [...existingPlugins, PLUGIN_NAME],
		};
		const tmpJsonPath = `${jsonPath}.tmp.${randomBytes(8).toString("hex")}`;
		await writeFile(tmpJsonPath, JSON.stringify(opencodeJson, null, 2), "utf-8");
		await rename(tmpJsonPath, jsonPath);
		console.log(`  ${green("✓")} Plugin registered`);
	}

	// 4. Create starter config (skip if exists)
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

	// 5. Print next steps
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
): Promise<{ hasFailure: boolean; config: Awaited<ReturnType<typeof loadConfig>> }> {
	let hasFailure = false;

	console.log(bold("System"));

	// 1. OpenCode installed
	const version = await checkOpenCodeInstalled();
	if (version) {
		console.log(`  OpenCode installed      ${green("✓")} ${version}`);
	} else {
		console.log(
			`  OpenCode installed      ${red("✗")} not found — install from https://opencode.ai`,
		);
		hasFailure = true;
	}

	// 2. Plugin registered
	const jsonPath = join(cwd, OPENCODE_JSON);
	if (await fileExists(jsonPath)) {
		try {
			const raw = await readFile(jsonPath, "utf-8");
			const parsed = JSON.parse(raw) as { plugin?: string[] };
			if (Array.isArray(parsed.plugin) && parsed.plugin.includes(PLUGIN_NAME)) {
				console.log(`  Plugin registered       ${green("✓")} ${OPENCODE_JSON}`);
			} else {
				console.log(`  Plugin registered       ${red("✗")} not in ${OPENCODE_JSON} — run install`);
				hasFailure = true;
			}
		} catch (error: unknown) {
			if (error instanceof SyntaxError) {
				console.log(
					`  Plugin registered       ${red("✗")} invalid ${OPENCODE_JSON} — fix JSON syntax`,
				);
			} else {
				console.log(
					`  Plugin registered       ${red("✗")} could not read ${OPENCODE_JSON}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
			hasFailure = true;
		}
	} else {
		console.log(`  Plugin registered       ${red("✗")} ${OPENCODE_JSON} not found — run install`);
		hasFailure = true;
	}

	// 3. Config file exists + schema valid
	const config = await loadConfig(configPath);
	if (config) {
		console.log(`  Config file             ${green("✓")} found`);
		console.log(`  Config schema           ${green("✓")} v${config.version}`);
	} else {
		console.log(`  Config file             ${red("✗")} not found — run install`);
		hasFailure = true;
	}

	// 4. Setup completed
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

	return { hasFailure, config };
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

// ── runDoctor ───────────────────────────────────────────────────────

export async function runDoctor(options: CliOptions = {}): Promise<void> {
	const cwd = options.cwd ?? process.cwd();
	const configPath = options.configDir ?? CONFIG_PATH;

	console.log("");
	console.log(bold("opencode-autopilot doctor"));
	console.log("─────────────────────────");
	console.log("");

	const { hasFailure, config } = await printSystemChecks(cwd, configPath);

	// Run shared diagnosis logic
	const result = diagnose(config);

	printModelAssignments(result);
	printDiversityResults(result, config);

	// ── Summary ────────────────────────────────────────────────

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
