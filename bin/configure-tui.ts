/**
 * Interactive TUI for configuring model assignments.
 * Uses @inquirer/search (filterable single-select) and @inquirer/checkbox
 * (multi-select) to handle 100+ models deterministically — no LLM involved.
 */

import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import checkbox, { Separator as CheckboxSeparator } from "@inquirer/checkbox";
import confirm from "@inquirer/confirm";
import search from "@inquirer/search";
import { CONFIG_PATH, createDefaultConfig, loadConfig, saveConfig } from "../src/config";
import { checkDiversity } from "../src/registry/diversity";
import { ALL_GROUP_IDS, DIVERSITY_RULES, GROUP_DEFINITIONS } from "../src/registry/model-groups";
import type { GroupId, GroupModelAssignment } from "../src/registry/types";

const execFile = promisify(execFileCb);

// ── ANSI helpers ───────────────────────────────────────────────────

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

// ── Model discovery ────────────────────────────────────────────────

interface DiscoveredModel {
	readonly id: string; // "provider/model"
	readonly provider: string;
	readonly model: string;
}

/**
 * Discover available models by running `opencode models`.
 * Each line of output is a "provider/model" string.
 */
async function discoverModels(): Promise<readonly DiscoveredModel[]> {
	try {
		const { stdout } = await execFile("opencode", ["models"]);
		const lines = stdout
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);

		return lines.map((id) => {
			const slashIndex = id.indexOf("/");
			return {
				id,
				provider: slashIndex > 0 ? id.slice(0, slashIndex) : "unknown",
				model: slashIndex > 0 ? id.slice(slashIndex + 1) : id,
			};
		});
	} catch {
		return [];
	}
}

/**
 * Group models by provider for display with separators.
 */
function groupByProvider(models: readonly DiscoveredModel[]): Map<string, DiscoveredModel[]> {
	const grouped = new Map<string, DiscoveredModel[]>();
	for (const m of models) {
		const existing = grouped.get(m.provider) ?? [];
		existing.push(m);
		grouped.set(m.provider, existing);
	}
	return grouped;
}

// ── Search source for @inquirer/search ─────────────────────────────

function createSearchSource(models: readonly DiscoveredModel[], exclude?: Set<string>) {
	const byProvider = groupByProvider(models);

	return async (term: string | undefined) => {
		const results: Array<
			{ name: string; value: string; description: string } | typeof CheckboxSeparator.prototype
		> = [];

		for (const [provider, providerModels] of byProvider) {
			const filtered = providerModels.filter((m) => {
				if (exclude?.has(m.id)) return false;
				if (!term) return true;
				return m.id.toLowerCase().includes(term.toLowerCase());
			});

			if (filtered.length === 0) continue;

			results.push(new CheckboxSeparator(`── ${provider} ──`));
			for (const m of filtered) {
				results.push({
					name: m.id,
					value: m.id,
					description: m.model,
				});
			}
		}

		return results;
	};
}

// ── Checkbox choices for fallback selection ─────────────────────────

function createCheckboxChoices(models: readonly DiscoveredModel[], excludePrimary: string) {
	const byProvider = groupByProvider(models);
	const choices: Array<{ name: string; value: string } | InstanceType<typeof CheckboxSeparator>> =
		[];

	for (const [provider, providerModels] of byProvider) {
		const filtered = providerModels.filter((m) => m.id !== excludePrimary);
		if (filtered.length === 0) continue;

		choices.push(new CheckboxSeparator(`── ${provider} ──`));
		for (const m of filtered) {
			choices.push({
				name: m.id,
				value: m.id,
			});
		}
	}

	return choices;
}

// ── Diversity check display ────────────────────────────────────────

function extractFamily(model: string): string {
	const slashIndex = model.indexOf("/");
	return slashIndex > 0 ? model.slice(0, slashIndex) : model;
}

function showDiversityWarnings(assignments: Record<string, GroupModelAssignment>): void {
	const warnings = checkDiversity(assignments);
	if (warnings.length === 0) return;

	console.log("");
	for (const w of warnings) {
		const groupLabels = w.groups.map((g) => GROUP_DEFINITIONS[g as GroupId]?.label ?? g);
		const label = groupLabels.join(" & ");
		const severity = w.rule.severity === "strong" ? red("WARNING") : yellow("note");
		console.log(`  ${severity}: ${label} both use ${cyan(w.sharedFamily)} family`);
		console.log(`  ${dim(w.rule.reason)}`);
		console.log("");
	}
}

// ── Group walkthrough ──────────────────────────────────────────────

async function configureGroup(
	groupId: GroupId,
	models: readonly DiscoveredModel[],
	assignments: Record<string, GroupModelAssignment>,
): Promise<GroupModelAssignment> {
	const def = GROUP_DEFINITIONS[groupId];

	console.log("");
	console.log(bold(`── ${def.label} ──────────────────────────────────────`));
	console.log(`  ${dim("Purpose:")} ${def.purpose}`);
	console.log(`  ${dim("Recommendation:")} ${def.recommendation}`);

	// Check if this group is adversarial to another
	for (const rule of DIVERSITY_RULES) {
		if (rule.groups.includes(groupId)) {
			const others = rule.groups.filter((g) => g !== groupId);
			const assignedOthers = others.filter((g) => assignments[g]);
			if (assignedOthers.length > 0) {
				const otherLabels = assignedOthers.map(
					(g) =>
						`${GROUP_DEFINITIONS[g as GroupId].label} (${extractFamily(assignments[g].primary)})`,
				);
				console.log(
					`  ${yellow("⚡")} Adversarial to: ${otherLabels.join(", ")} — pick a ${bold("different")} family`,
				);
			}
		}
	}

	console.log("");

	// Primary model — searchable select
	const primary = await search({
		message: `Primary model for ${def.label}:`,
		source: createSearchSource(models),
		pageSize: 15,
	});

	// Fallback models — checkbox multi-select
	const wantFallbacks = await confirm({
		message: "Add fallback models? (recommended for resilience)",
		default: true,
	});

	let fallbacks: string[] = [];
	if (wantFallbacks) {
		fallbacks = await checkbox({
			message: `Fallback models for ${def.label} (space to select, enter to confirm):`,
			choices: createCheckboxChoices(models, primary),
			pageSize: 15,
		});
	}

	const assignment: GroupModelAssignment = Object.freeze({
		primary,
		fallbacks: Object.freeze(fallbacks),
	});

	// Show what was selected
	console.log(
		`  ${green("✓")} ${def.label}: ${cyan(primary)}${fallbacks.length > 0 ? ` → ${fallbacks.map(cyan).join(" → ")}` : ""}`,
	);

	return assignment;
}

// ── Main configure flow ────────────────────────────────────────────

export async function runConfigure(configPath: string = CONFIG_PATH): Promise<void> {
	console.log("");
	console.log(bold("opencode-autopilot configure"));
	console.log("────────────────────────────");
	console.log("");

	// 1. Discover models
	console.log("  Discovering available models...");
	const models = await discoverModels();

	if (models.length === 0) {
		console.log("");
		console.log(red("  No models found."));
		console.log("  Make sure OpenCode is installed and you have providers configured.");
		console.log("  Run: opencode providers list");
		console.log("");
		process.exit(1);
	}

	const byProvider = groupByProvider(models);
	console.log(
		`  ${green("✓")} Found ${bold(String(models.length))} models from ${bold(String(byProvider.size))} providers`,
	);

	// 2. Load existing config
	const existingConfig = await loadConfig(configPath);
	if (existingConfig?.configured) {
		console.log(`  ${yellow("⚠")} Existing configuration found — this will overwrite it`);
		const proceed = await confirm({
			message: "Continue with reconfiguration?",
			default: true,
		});
		if (!proceed) {
			console.log("  Cancelled.");
			return;
		}
	}

	console.log("");
	console.log(bold("Walk through each agent group and assign models."));
	console.log(dim("Type to search, arrow keys to navigate, enter to select."));
	console.log(dim("For fallbacks: space to toggle, enter to confirm selection."));

	// 3. Walk through each group
	const assignments: Record<string, GroupModelAssignment> = {};

	for (const groupId of ALL_GROUP_IDS) {
		assignments[groupId] = await configureGroup(groupId, models, assignments);
		showDiversityWarnings(assignments);
	}

	// 4. Show summary
	console.log("");
	console.log(bold("── Summary ───────────────────────────────────────────"));
	console.log("");

	const labelWidth = Math.max(...ALL_GROUP_IDS.map((id) => GROUP_DEFINITIONS[id].label.length)) + 2;

	for (const groupId of ALL_GROUP_IDS) {
		const def = GROUP_DEFINITIONS[groupId];
		const a = assignments[groupId];
		const label = def.label.padEnd(labelWidth);
		const fallbackStr = a.fallbacks.length > 0 ? ` → ${a.fallbacks.join(" → ")}` : "";
		console.log(`  ${label} ${cyan(a.primary)}${dim(fallbackStr)}`);
	}

	console.log("");

	// 5. Confirm and save
	const doCommit = await confirm({
		message: "Save this configuration?",
		default: true,
	});

	if (!doCommit) {
		console.log("  Configuration discarded.");
		return;
	}

	// Build and save config
	const baseConfig = existingConfig ?? createDefaultConfig();
	const groupsRecord: Record<string, { primary: string; fallbacks: string[] }> = {};
	for (const [key, val] of Object.entries(assignments)) {
		groupsRecord[key] = { primary: val.primary, fallbacks: [...val.fallbacks] };
	}

	const newConfig = {
		...baseConfig,
		version: 5 as const,
		configured: true,
		groups: groupsRecord,
		overrides: baseConfig.overrides ?? {},
	};

	await saveConfig(newConfig, configPath);
	console.log(`  ${green("✓")} Configuration saved`);

	// 6. Final diversity check
	console.log("");
	console.log(bold("Adversarial Diversity Check"));
	const finalWarnings = checkDiversity(groupsRecord);
	if (finalWarnings.length === 0) {
		console.log(`  ${green("✓")} All adversarial groups use different model families`);
	} else {
		for (const w of finalWarnings) {
			const groupLabels = w.groups.map((g) => GROUP_DEFINITIONS[g as GroupId]?.label ?? g);
			console.log(
				`  ${yellow("⚠")} ${groupLabels.join(" & ")}: shared ${cyan(w.sharedFamily)} family — ${dim(w.rule.reason)}`,
			);
		}
	}

	console.log("");
	console.log(green("Configuration complete!"));
	console.log(dim("Run 'bunx @kodrunhq/opencode-autopilot doctor' to verify."));
	console.log("");
}
