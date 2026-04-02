import type { Config } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { createDefaultConfig, loadConfig, saveConfig } from "../config";
import { checkDiversity } from "../registry/diversity";
import { diagnose } from "../registry/doctor";
import {
	AGENT_REGISTRY,
	ALL_GROUP_IDS,
	DIVERSITY_RULES,
	GROUP_DEFINITIONS,
} from "../registry/model-groups";
import type { DiversityWarning, GroupModelAssignment } from "../registry/types";

// --- Module-level state ---

// Module-level mutable state is intentional: oc_configure is a session-scoped
// workflow where assignments accumulate across multiple "assign" calls before
// being persisted by "commit". The Map is cleared on commit and reset.

/**
 * In-progress group assignments, keyed by GroupId.
 * Populated by "assign" subcommand, persisted by "commit", cleared by "reset".
 * Held in memory — configuration is a single-session flow.
 */
let pendingAssignments: Map<string, GroupModelAssignment> = new Map();

/**
 * Reference to the OpenCode host config, set by the plugin's config hook.
 * Retained for potential future use by subcommands.
 */
// biome-ignore lint/correctness/noUnusedVariables: retained for API compatibility
let openCodeConfig: Config | null = null;

/**
 * Provider data from the OpenCode SDK, set during plugin initialization.
 * Each entry maps a provider ID to its available models.
 */
let availableProviders: ReadonlyArray<{
	readonly id: string;
	readonly name: string;
	readonly models: Readonly<Record<string, { readonly id: string; readonly name: string }>>;
}> = [];

/**
 * Promise that resolves when provider discovery completes (or fails).
 * handleStart awaits this (with timeout) so oc_configure doesn't race
 * against background discovery.
 */
let providerDiscoveryPromise: Promise<void> = Promise.resolve();

// --- Exported helpers for test/plugin wiring ---

export function resetPendingAssignments(): void {
	pendingAssignments = new Map();
	availableProviders = [];
	providerDiscoveryPromise = Promise.resolve();
}

export function setOpenCodeConfig(config: Config | null): void {
	openCodeConfig = config;
}

export function setAvailableProviders(
	providers: ReadonlyArray<{
		readonly id: string;
		readonly name: string;
		readonly models: Readonly<Record<string, { readonly id: string; readonly name: string }>>;
	}>,
): void {
	availableProviders = providers;
}

export function setProviderDiscoveryPromise(promise: Promise<void>): void {
	providerDiscoveryPromise = promise;
}

// --- Core logic ---

interface ConfigureArgs {
	readonly subcommand: "start" | "assign" | "commit" | "doctor" | "reset";
	readonly group?: string;
	readonly primary?: string;
	readonly fallbacks?: string;
}

/**
 * Discover available models from the stored provider data.
 * Returns a map of provider ID -> list of fully-qualified model ID strings.
 *
 * Uses the model's own `id` field (which may contain sub-provider paths like
 * "anthropic/claude-opus-4-6" for a Zen provider) to construct the full
 * "provider/model" path. This ensures Zen-proxied models display as
 * "zen/anthropic/claude-opus-4-6" matching OpenCode's native `/models` output.
 */
function discoverAvailableModels(): Map<string, string[]> {
	const modelsByProvider = new Map<string, string[]>();

	for (const provider of availableProviders) {
		const modelIds: string[] = [];
		for (const [modelKey, modelData] of Object.entries(provider.models)) {
			// Prefer the model's id field — it carries sub-provider paths
			// (e.g. "anthropic/claude-opus-4-6" under a "zen" provider).
			// Fall back to the record key when the id is absent or empty.
			const modelId = modelData.id || modelKey;
			const fullId = `${provider.id}/${modelId}`;
			modelIds.push(fullId);
		}
		if (modelIds.length > 0) {
			modelsByProvider.set(provider.id, modelIds);
		}
	}

	return modelsByProvider;
}

function serializeDiversityWarnings(warnings: readonly DiversityWarning[]): readonly {
	groups: readonly string[];
	severity: string;
	sharedFamily: string;
	reason: string;
}[] {
	return warnings.map((w) => ({
		groups: w.groups,
		severity: w.rule.severity,
		sharedFamily: w.sharedFamily,
		reason: w.rule.reason,
	}));
}

/**
 * Build a flat numbered list of all available models and an index map.
 * Returns { numberedList: "1. provider/model\n2. ...", indexMap: { "1": "provider/model", ... } }
 */
function buildNumberedModelList(modelsByProvider: Map<string, string[]>): {
	numberedList: string;
	indexMap: Record<string, string>;
	totalCount: number;
} {
	const allModels: string[] = [];
	for (const models of modelsByProvider.values()) {
		allModels.push(...models);
	}
	// Sort alphabetically for stable ordering
	allModels.sort();

	const indexMap: Record<string, string> = {};
	const lines: string[] = [];
	for (let i = 0; i < allModels.length; i++) {
		const num = String(i + 1);
		indexMap[num] = allModels[i];
		lines.push(`  ${num}. ${allModels[i]}`);
	}

	return {
		numberedList: lines.join("\n"),
		indexMap,
		totalCount: allModels.length,
	};
}

async function handleStart(configPath?: string): Promise<string> {
	// Wait for background provider discovery (up to 5s) before building model list
	await Promise.race([
		providerDiscoveryPromise,
		new Promise<void>((resolve) => setTimeout(resolve, 5000)),
	]);

	const modelsByProvider = discoverAvailableModels();
	const { numberedList, indexMap, totalCount } = buildNumberedModelList(modelsByProvider);

	// Load current plugin config to show existing assignments
	const currentConfig = await loadConfig(configPath);

	// Build groups with agents derived from AGENT_REGISTRY
	const groups = ALL_GROUP_IDS.map((groupId) => {
		const def = GROUP_DEFINITIONS[groupId];
		const agents = Object.entries(AGENT_REGISTRY)
			.filter(([, entry]) => entry.group === groupId)
			.map(([name]) => name);

		return {
			id: def.id,
			label: def.label,
			purpose: def.purpose,
			recommendation: def.recommendation,
			tier: def.tier,
			order: def.order,
			agents,
			currentAssignment: currentConfig?.groups[groupId] ?? null,
		};
	});

	// Pre-formatted text the LLM should show verbatim — avoids summarization
	const displayText =
		totalCount > 0
			? [
					`Available models (${totalCount} total):`,
					numberedList,
					"",
					"For each group below, enter model numbers separated by commas (e.g. 1,4,7).",
					"First number = primary model. Remaining = fallbacks tried in order.",
					"More fallbacks = more resilience when a model is rate-limited.",
				].join("\n")
			: [
					"No models were discovered from your providers.",
					"Run `opencode models` in your terminal to see available models,",
					"then type model IDs manually (e.g. anthropic/claude-opus-4-6).",
				].join("\n");

	// Compact group summaries — only fields the LLM needs for the walkthrough
	const compactGroups = groups.map((g) => ({
		id: g.id,
		label: g.label,
		purpose: g.purpose,
		recommendation: g.recommendation,
		agents: g.agents,
		currentAssignment: g.currentAssignment,
	}));

	// Compact diversity rules — just the text the LLM should mention
	const compactRules = DIVERSITY_RULES.map((r) => ({
		groups: r.groups,
		severity: r.severity,
		reason: r.reason,
	}));

	// NOTE: availableModels is intentionally excluded — it's redundant with
	// displayText/modelIndex and can be 400KB+ with many providers, causing
	// OpenCode to truncate the tool output and lose everything after it.
	return JSON.stringify({
		action: "configure",
		stage: "start",
		displayText,
		modelIndex: indexMap,
		groups: compactGroups,
		diversityRules: compactRules,
		currentConfig: currentConfig
			? { configured: currentConfig.configured, groups: currentConfig.groups }
			: null,
	});
}

function handleAssign(args: ConfigureArgs): string {
	const { group, primary, fallbacks: fallbacksStr } = args;

	// Validate group
	if (!group || !ALL_GROUP_IDS.includes(group as (typeof ALL_GROUP_IDS)[number])) {
		return JSON.stringify({
			action: "error",
			message: `Invalid group: '${group ?? ""}'. Valid groups: ${ALL_GROUP_IDS.join(", ")}`,
		});
	}

	// Validate primary
	if (!primary || primary.trim().length === 0) {
		return JSON.stringify({
			action: "error",
			message: "Primary model is required for assign subcommand.",
		});
	}

	const trimmedPrimary = primary.trim();

	// Parse fallbacks
	const parsedFallbacks = fallbacksStr
		? fallbacksStr
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

	// Store assignment
	const assignment: GroupModelAssignment = Object.freeze({
		primary: trimmedPrimary,
		fallbacks: Object.freeze(parsedFallbacks),
	});
	pendingAssignments.set(group, assignment);

	// Run diversity check on all pending assignments
	const assignmentRecord: Record<string, GroupModelAssignment> =
		Object.fromEntries(pendingAssignments);
	const diversityWarnings = serializeDiversityWarnings(checkDiversity(assignmentRecord));

	return JSON.stringify({
		action: "configure",
		stage: "assigned",
		group,
		primary: trimmedPrimary,
		fallbacks: parsedFallbacks,
		assignedCount: pendingAssignments.size,
		totalGroups: ALL_GROUP_IDS.length,
		diversityWarnings,
	});
}

async function handleCommit(configPath?: string): Promise<string> {
	// Validate all groups assigned
	if (pendingAssignments.size < ALL_GROUP_IDS.length) {
		const assigned = new Set(pendingAssignments.keys());
		const missing = ALL_GROUP_IDS.filter((id) => !assigned.has(id));
		return JSON.stringify({
			action: "error",
			message: `Cannot commit: ${missing.length} group(s) missing assignments: ${missing.join(", ")}`,
		});
	}

	// Load current config or create default
	const currentConfig = (await loadConfig(configPath)) ?? createDefaultConfig();

	// Build new config — convert readonly fallbacks to mutable for Zod schema compatibility
	const groupsRecord: Record<string, { primary: string; fallbacks: string[] }> = {};
	for (const [key, val] of pendingAssignments) {
		groupsRecord[key] = { primary: val.primary, fallbacks: [...val.fallbacks] };
	}
	const newConfig = {
		...currentConfig,
		version: 4 as const,
		configured: true,
		groups: groupsRecord,
		overrides: currentConfig.overrides ?? {},
	};

	// Save
	await saveConfig(newConfig, configPath);

	// Clear pending
	const savedGroups = { ...groupsRecord };
	pendingAssignments.clear();

	// Final diversity check
	const diversityWarnings = serializeDiversityWarnings(checkDiversity(savedGroups));

	return JSON.stringify({
		action: "configure",
		stage: "committed",
		groups: savedGroups,
		diversityWarnings,
		configPath: configPath ?? "~/.config/opencode/opencode-autopilot.json",
	});
}

async function handleDoctor(configPath?: string): Promise<string> {
	const config = await loadConfig(configPath);
	const result = diagnose(config);

	return JSON.stringify({
		action: "configure",
		stage: "doctor",
		checks: {
			configExists: result.configExists,
			schemaValid: result.schemaValid,
			configured: result.configured,
			groupsAssigned: result.groupsAssigned,
		},
		diversityWarnings: serializeDiversityWarnings(result.diversityWarnings),
		allPassed: result.allPassed,
	});
}

function handleReset(): string {
	pendingAssignments.clear();
	return JSON.stringify({
		action: "configure",
		stage: "reset",
		message: "All in-progress assignments cleared.",
	});
}

// --- Public API ---

export async function configureCore(args: ConfigureArgs, configPath?: string): Promise<string> {
	switch (args.subcommand) {
		case "start":
			return handleStart(configPath);
		case "assign":
			return handleAssign(args);
		case "commit":
			return handleCommit(configPath);
		case "doctor":
			return handleDoctor(configPath);
		case "reset":
			return handleReset();
		default:
			return JSON.stringify({
				action: "error",
				message: `Unknown subcommand: '${args.subcommand}'`,
			});
	}
}

// --- Tool wrapper ---

export const ocConfigure = tool({
	description:
		"Configure model assignments for opencode-autopilot agent groups. " +
		"Subcommands: start (discover models), assign (set group model), " +
		"commit (persist), doctor (diagnose), reset (clear in-progress).",
	args: {
		subcommand: tool.schema
			.enum(["start", "assign", "commit", "doctor", "reset"])
			.describe("Action to perform"),
		group: tool.schema
			.string()
			.optional()
			.describe("Group ID for assign subcommand (e.g. 'architects')"),
		primary: tool.schema
			.string()
			.optional()
			.describe("Primary model ID for assign subcommand (e.g. 'anthropic/claude-opus-4-6')"),
		fallbacks: tool.schema
			.string()
			.optional()
			.describe("Comma-separated fallback model IDs for assign subcommand"),
	},
	async execute(args) {
		return configureCore(args);
	},
});
