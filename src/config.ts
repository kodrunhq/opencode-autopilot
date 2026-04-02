import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { fallbackConfigSchema, fallbackDefaults } from "./orchestrator/fallback/fallback-config";
import { AGENT_REGISTRY, ALL_GROUP_IDS } from "./registry/model-groups";
import { ensureDir, isEnoentError } from "./utils/fs-helpers";
import { getGlobalConfigDir } from "./utils/paths";

// --- V1 schema (internal, for migration) ---

const pluginConfigSchemaV1 = z.object({
	version: z.literal(1),
	configured: z.boolean(),
	models: z.record(z.string(), z.string()),
});

type PluginConfigV1 = z.infer<typeof pluginConfigSchemaV1>;

// --- V2 sub-schemas ---

const phasesConfigSchema = z.object({
	recon: z.boolean().default(true),
	challenge: z.boolean().default(true),
	architect: z.boolean().default(true),
	explore: z.boolean().default(true),
	plan: z.boolean().default(true),
	build: z.boolean().default(true),
	ship: z.boolean().default(true),
	retrospective: z.boolean().default(true),
});

const thresholdsConfigSchema = z.object({
	proceed: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
	abort: z.enum(["HIGH", "MEDIUM", "LOW"]).default("LOW"),
});

export const orchestratorConfigSchema = z.object({
	autonomy: z.enum(["full", "supervised", "manual"]).default("full"),
	strictness: z.enum(["strict", "normal", "lenient"]).default("normal"),
	phases: phasesConfigSchema.default(phasesConfigSchema.parse({})),
});

export const confidenceConfigSchema = z.object({
	enabled: z.boolean().default(true),
	thresholds: thresholdsConfigSchema.default(thresholdsConfigSchema.parse({})),
});

// Pre-compute full defaults for nested schema defaults
const orchestratorDefaults = orchestratorConfigSchema.parse({});
const confidenceDefaults = confidenceConfigSchema.parse({});

// --- V2 schema (internal, for migration) ---

const pluginConfigSchemaV2 = z.object({
	version: z.literal(2),
	configured: z.boolean(),
	models: z.record(z.string(), z.string()),
	orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
	confidence: confidenceConfigSchema.default(confidenceDefaults),
});

type PluginConfigV2 = z.infer<typeof pluginConfigSchemaV2>;

// --- V3 schema (internal, for migration) ---

const pluginConfigSchemaV3 = z.object({
	version: z.literal(3),
	configured: z.boolean(),
	models: z.record(z.string(), z.string()),
	orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
	confidence: confidenceConfigSchema.default(confidenceDefaults),
	fallback: fallbackConfigSchema.default(fallbackDefaults),
	fallback_models: z.union([z.string(), z.array(z.string())]).optional(),
});

type PluginConfigV3 = z.infer<typeof pluginConfigSchemaV3>;

// --- V4 sub-schemas ---

const groupModelAssignmentSchema = z.object({
	primary: z.string().min(1),
	fallbacks: z.array(z.string().min(1)).default([]),
});

const agentOverrideSchema = z.object({
	primary: z.string().min(1),
	fallbacks: z.array(z.string().min(1)).optional(),
});

// --- V4 schema ---

const pluginConfigSchemaV4 = z
	.object({
		version: z.literal(4),
		configured: z.boolean(),
		groups: z.record(z.string(), groupModelAssignmentSchema).default({}),
		overrides: z.record(z.string(), agentOverrideSchema).default({}),
		orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
		confidence: confidenceConfigSchema.default(confidenceDefaults),
		fallback: fallbackConfigSchema.default(fallbackDefaults),
	})
	.superRefine((config, ctx) => {
		for (const groupId of Object.keys(config.groups)) {
			if (!ALL_GROUP_IDS.includes(groupId as (typeof ALL_GROUP_IDS)[number])) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["groups", groupId],
					message: `Unknown group id "${groupId}". Expected one of: ${ALL_GROUP_IDS.join(", ")}`,
				});
			}
		}
	});

// Export aliases updated to v4
export const pluginConfigSchema = pluginConfigSchemaV4;

export type PluginConfig = z.infer<typeof pluginConfigSchemaV4>;

export const CONFIG_PATH = join(getGlobalConfigDir(), "opencode-autopilot.json");

// --- Migration ---

function migrateV1toV2(v1Config: PluginConfigV1): PluginConfigV2 {
	return {
		version: 2 as const,
		configured: v1Config.configured,
		models: v1Config.models,
		orchestrator: orchestratorDefaults,
		confidence: confidenceDefaults,
	};
}

function migrateV2toV3(v2Config: PluginConfigV2): PluginConfigV3 {
	return {
		version: 3 as const,
		configured: v2Config.configured,
		models: v2Config.models,
		orchestrator: v2Config.orchestrator,
		confidence: v2Config.confidence,
		fallback: fallbackDefaults,
	};
}

function migrateV3toV4(v3Config: PluginConfigV3): PluginConfig {
	const groups: Record<string, { primary: string; fallbacks: string[] }> = {};
	const overrides: Record<string, { primary: string }> = {};

	// Step 1: Reverse-map v3 flat models to groups
	// v3.models is Record<string, string> where key is agent name, value is model id
	for (const [agentName, modelId] of Object.entries(v3Config.models)) {
		const entry = AGENT_REGISTRY[agentName];
		if (!entry) {
			// Agent not in registry — preserve as per-agent override
			overrides[agentName] = { primary: modelId };
			continue;
		}

		const groupId = entry.group;
		if (!groups[groupId]) {
			// First agent in this group sets the primary
			groups[groupId] = { primary: modelId, fallbacks: [] };
		} else if (groups[groupId].primary !== modelId) {
			// Different model for same group — becomes an override
			overrides[agentName] = { primary: modelId };
		}
		// Same model as group primary — no override needed
	}

	// Step 2: Migrate global fallback_models to per-group fallbacks
	const globalFallbacks = v3Config.fallback_models
		? typeof v3Config.fallback_models === "string"
			? [v3Config.fallback_models]
			: [...v3Config.fallback_models]
		: [];

	for (const group of Object.values(groups)) {
		if (group.fallbacks.length === 0 && globalFallbacks.length > 0) {
			group.fallbacks = [...globalFallbacks];
		}
	}

	return {
		version: 4 as const,
		configured: v3Config.configured,
		groups,
		overrides,
		orchestrator: v3Config.orchestrator,
		confidence: v3Config.confidence,
		fallback: v3Config.fallback,
	};
}

// --- Public API ---

export async function loadConfig(configPath: string = CONFIG_PATH): Promise<PluginConfig | null> {
	try {
		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw);

		// Try v4 first
		const v4Result = pluginConfigSchemaV4.safeParse(parsed);
		if (v4Result.success) return v4Result.data;

		// Try v3 and migrate to v4
		const v3Result = pluginConfigSchemaV3.safeParse(parsed);
		if (v3Result.success) {
			const migrated = migrateV3toV4(v3Result.data);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		// Try v2 → v3 → v4
		const v2Result = pluginConfigSchemaV2.safeParse(parsed);
		if (v2Result.success) {
			const v3 = migrateV2toV3(v2Result.data);
			const migrated = migrateV3toV4(v3);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		// Try v1 → v2 → v3 → v4
		const v1Result = pluginConfigSchemaV1.safeParse(parsed);
		if (v1Result.success) {
			const v2 = migrateV1toV2(v1Result.data);
			const v3 = migrateV2toV3(v2);
			const migrated = migrateV3toV4(v3);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		return pluginConfigSchemaV4.parse(parsed); // throw with proper error
	} catch (error: unknown) {
		if (isEnoentError(error)) return null;
		throw error;
	}
}

export async function saveConfig(
	config: PluginConfig,
	configPath: string = CONFIG_PATH,
): Promise<void> {
	await ensureDir(dirname(configPath));
	const tmpPath = `${configPath}.tmp.${randomBytes(8).toString("hex")}`;
	await writeFile(tmpPath, JSON.stringify(config, null, 2), "utf-8");
	await rename(tmpPath, configPath);
}

export function isFirstLoad(config: PluginConfig | null): boolean {
	return config === null || !config.configured;
}

export function createDefaultConfig(): PluginConfig {
	return {
		version: 4 as const,
		configured: false,
		groups: {},
		overrides: {},
		orchestrator: orchestratorDefaults,
		confidence: confidenceDefaults,
		fallback: fallbackDefaults,
	};
}
