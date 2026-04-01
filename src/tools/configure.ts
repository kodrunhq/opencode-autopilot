import type { Config } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { createDefaultConfig, loadConfig, saveConfig } from "../config";
import { checkDiversity } from "../registry/diversity";
import {
	AGENT_REGISTRY,
	ALL_GROUP_IDS,
	DIVERSITY_RULES,
	GROUP_DEFINITIONS,
} from "../registry/model-groups";
import { extractFamily } from "../registry/resolver";
import type { GroupModelAssignment } from "../registry/types";

// --- Module-level state ---

/**
 * In-progress group assignments, keyed by GroupId.
 * Populated by "assign" subcommand, persisted by "commit", cleared by "reset".
 * Held in memory — configuration is a single-session flow.
 */
let pendingAssignments: Map<string, GroupModelAssignment> = new Map();

/**
 * Reference to the OpenCode host config, set by the plugin's config hook.
 * Used by "start" subcommand to discover available models.
 */
let openCodeConfig: Config | null = null;

// --- Exported helpers for test/plugin wiring ---

export function resetPendingAssignments(): void {
	pendingAssignments = new Map();
}

export function setOpenCodeConfig(config: Config | null): void {
	openCodeConfig = config;
}

// --- Core logic ---

interface ConfigureArgs {
	readonly subcommand: "start" | "assign" | "commit" | "doctor" | "reset";
	readonly group?: string;
	readonly primary?: string;
	readonly fallbacks?: string;
}

function handleStart(): string {
	// Extract available models from openCodeConfig
	const modelsByFamily = new Map<string, string[]>();

	if (openCodeConfig) {
		const seen = new Set<string>();

		// Collect from agent configs
		const agentConfigs = openCodeConfig.agent as
			| Record<string, Record<string, unknown>>
			| undefined;
		if (agentConfigs) {
			for (const agentCfg of Object.values(agentConfigs)) {
				const model = agentCfg.model as string | undefined;
				if (model && !seen.has(model)) {
					seen.add(model);
					const family = extractFamily(model);
					const list = modelsByFamily.get(family) ?? [];
					list.push(model);
					modelsByFamily.set(family, list);
				}
			}
		}

		// Also include top-level model and small_model
		const topModel = (openCodeConfig as Record<string, unknown>).model as string | undefined;
		const smallModel = (openCodeConfig as Record<string, unknown>).small_model as
			| string
			| undefined;
		for (const m of [topModel, smallModel]) {
			if (m && !seen.has(m)) {
				seen.add(m);
				const family = extractFamily(m);
				const list = modelsByFamily.get(family) ?? [];
				list.push(m);
				modelsByFamily.set(family, list);
			}
		}
	}

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
			currentAssignment: null as GroupModelAssignment | null,
		};
	});

	// Load current config synchronously is not possible — return null for now
	// The AI can call doctor separately to see current state
	return JSON.stringify({
		action: "configure",
		stage: "start",
		availableModels: Object.fromEntries(modelsByFamily),
		groups,
		currentConfig: null,
		diversityRules: DIVERSITY_RULES,
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

	// Parse fallbacks
	const fallbacks = fallbacksStr
		? fallbacksStr
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

	// Store assignment
	const assignment: GroupModelAssignment = { primary, fallbacks };
	pendingAssignments.set(group, assignment);

	// Run diversity check on all pending assignments
	const assignmentRecord: Record<string, GroupModelAssignment> =
		Object.fromEntries(pendingAssignments);
	const diversityWarnings = checkDiversity(assignmentRecord).map((w) => ({
		groups: w.groups,
		severity: w.rule.severity,
		sharedFamily: w.sharedFamily,
		reason: w.rule.reason,
	}));

	return JSON.stringify({
		action: "configure",
		stage: "assigned",
		group,
		primary,
		fallbacks,
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
	const diversityWarnings = checkDiversity(savedGroups).map((w) => ({
		groups: w.groups,
		severity: w.rule.severity,
		sharedFamily: w.sharedFamily,
		reason: w.rule.reason,
	}));

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

	const configExists = config !== null;
	let schemaValid = false;
	let configured = false;
	const groupsAssigned: Record<
		string,
		{
			assigned: boolean;
			primary: string | null;
			fallbacks: readonly string[];
		}
	> = {};

	if (config) {
		schemaValid = true;
		configured = config.configured;

		for (const groupId of ALL_GROUP_IDS) {
			const assignment = config.groups[groupId];
			groupsAssigned[groupId] = assignment
				? { assigned: true, primary: assignment.primary, fallbacks: assignment.fallbacks }
				: { assigned: false, primary: null, fallbacks: [] };
		}
	} else {
		for (const groupId of ALL_GROUP_IDS) {
			groupsAssigned[groupId] = { assigned: false, primary: null, fallbacks: [] };
		}
	}

	// Diversity check on assigned groups
	const assignedGroups: Record<string, GroupModelAssignment> = {};
	if (config) {
		for (const [key, val] of Object.entries(config.groups)) {
			assignedGroups[key] = val;
		}
	}

	const diversityWarnings = checkDiversity(assignedGroups).map((w) => ({
		groups: w.groups,
		severity: w.rule.severity,
		sharedFamily: w.sharedFamily,
		reason: w.rule.reason,
	}));

	const allPassed = configExists && schemaValid && configured && diversityWarnings.length === 0;

	return JSON.stringify({
		action: "configure",
		stage: "doctor",
		checks: {
			configExists,
			schemaValid,
			configured,
			groupsAssigned,
		},
		diversityWarnings,
		allPassed,
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
			return handleStart();
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
