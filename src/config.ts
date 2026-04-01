import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { fallbackConfigSchema, fallbackDefaults } from "./orchestrator/fallback/fallback-config";
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

// --- V3 schema ---

const pluginConfigSchemaV3 = z.object({
	version: z.literal(3),
	configured: z.boolean(),
	models: z.record(z.string(), z.string()),
	orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
	confidence: confidenceConfigSchema.default(confidenceDefaults),
	fallback: fallbackConfigSchema.default(fallbackDefaults),
});

// Export pluginConfigSchema as alias for v3 (preserves import compatibility)
export const pluginConfigSchema = pluginConfigSchemaV3;

export type PluginConfig = z.infer<typeof pluginConfigSchemaV3>;

export const CONFIG_PATH = join(getGlobalConfigDir(), "opencode-assets.json");

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

function migrateV2toV3(v2Config: PluginConfigV2): PluginConfig {
	return {
		version: 3 as const,
		configured: v2Config.configured,
		models: v2Config.models,
		orchestrator: v2Config.orchestrator,
		confidence: v2Config.confidence,
		fallback: fallbackDefaults,
	};
}

// --- Public API ---

export async function loadConfig(configPath: string = CONFIG_PATH): Promise<PluginConfig | null> {
	try {
		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw);

		// Try v3 first
		const v3Result = pluginConfigSchemaV3.safeParse(parsed);
		if (v3Result.success) {
			return v3Result.data;
		}

		// Try v2 and migrate to v3
		const v2Result = pluginConfigSchemaV2.safeParse(parsed);
		if (v2Result.success) {
			const migrated = migrateV2toV3(v2Result.data);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		// Try v1 and double-migrate v1->v2->v3
		const v1Result = pluginConfigSchemaV1.safeParse(parsed);
		if (v1Result.success) {
			const v2 = migrateV1toV2(v1Result.data);
			const migrated = migrateV2toV3(v2);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		// None matched -- force v3 parse to get proper error
		return pluginConfigSchemaV3.parse(parsed);
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return null;
		}
		throw error;
	}
}

export async function saveConfig(
	config: PluginConfig,
	configPath: string = CONFIG_PATH,
): Promise<void> {
	await ensureDir(dirname(configPath));
	const tmpPath = `${configPath}.tmp.${Date.now()}`;
	await writeFile(tmpPath, JSON.stringify(config, null, 2), "utf-8");
	await rename(tmpPath, configPath);
}

export function isFirstLoad(config: PluginConfig | null): boolean {
	return config === null || !config.configured;
}

export function createDefaultConfig(): PluginConfig {
	return {
		version: 3 as const,
		configured: false,
		models: {},
		orchestrator: orchestratorDefaults,
		confidence: confidenceDefaults,
		fallback: fallbackDefaults,
	};
}
