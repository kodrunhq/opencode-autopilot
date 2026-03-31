import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
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

// --- V2 schema ---

const pluginConfigSchemaV2 = z.object({
	version: z.literal(2),
	configured: z.boolean(),
	models: z.record(z.string(), z.string()),
	orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
	confidence: confidenceConfigSchema.default(confidenceDefaults),
});

// Export pluginConfigSchema as alias for v2 (preserves import compatibility)
export const pluginConfigSchema = pluginConfigSchemaV2;

export type PluginConfig = z.infer<typeof pluginConfigSchemaV2>;

export const CONFIG_PATH = join(getGlobalConfigDir(), "opencode-assets.json");

// --- Migration ---

function migrateV1toV2(v1Config: PluginConfigV1): PluginConfig {
	return {
		version: 2 as const,
		configured: v1Config.configured,
		models: v1Config.models,
		orchestrator: orchestratorDefaults,
		confidence: confidenceDefaults,
	};
}

// --- Public API ---

export async function loadConfig(configPath: string = CONFIG_PATH): Promise<PluginConfig | null> {
	try {
		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw);

		// Try v2 first
		const v2Result = pluginConfigSchemaV2.safeParse(parsed);
		if (v2Result.success) {
			return v2Result.data;
		}

		// Try v1 and migrate
		const v1Result = pluginConfigSchemaV1.safeParse(parsed);
		if (v1Result.success) {
			const migrated = migrateV1toV2(v1Result.data);
			// Persist the migrated config back to disk using atomic save
			await saveConfig(migrated, configPath);
			return migrated;
		}

		// Neither v1 nor v2 -- force v2 parse to get proper error
		return pluginConfigSchemaV2.parse(parsed);
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
		version: 2 as const,
		configured: false,
		models: {},
		orchestrator: orchestratorDefaults,
		confidence: confidenceDefaults,
	};
}
