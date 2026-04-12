import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import {
	fallbackConfigSchema,
	fallbackConfigSchemaV6,
	fallbackDefaults,
	fallbackDefaultsV6,
	testModeDefaults,
} from "./orchestrator/fallback/fallback-config";
import { AGENT_REGISTRY, ALL_GROUP_IDS } from "./registry/model-groups";
import { backgroundConfigSchema, backgroundDefaults } from "./types/background";
import { mcpConfigSchema, mcpDefaults } from "./types/mcp";
import { recoveryConfigSchema, recoveryDefaults } from "./types/recovery";
import { routingConfigSchema, routingDefaults } from "./types/routing";
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
	maxParallelTasks: z.number().int().min(1).max(10).default(5),
});

export const confidenceConfigSchema = z.object({
	enabled: z.boolean().default(true),
	thresholds: thresholdsConfigSchema.default(thresholdsConfigSchema.parse({})),
});

// Pre-compute full defaults for nested schema defaults
export const orchestratorDefaults = orchestratorConfigSchema.parse({});
export const confidenceDefaults = confidenceConfigSchema.parse({});

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

// --- Memory sub-schema ---

export const memoryConfigSchema = z.object({
	enabled: z.boolean().default(true),
	injectionBudget: z.number().min(500).max(5000).default(2000),
	decayHalfLifeDays: z.number().min(7).max(365).default(90),
});

export const memoryDefaults = memoryConfigSchema.parse({});

export const hashlineEditConfigSchema = z.object({
	enabled: z.boolean().default(true),
	enforce_for_agents: z.array(z.string()).default(["oc-implementer", "autopilot"]),
});

export const hashlineEditDefaults = hashlineEditConfigSchema.parse({});

export const notificationsConfigSchema = z.object({
	desktop: z.boolean().default(true),
	rateLimit: z.number().int().min(0).finite().default(5000),
});

export const notificationsDefaults = notificationsConfigSchema.parse({});

export const interactionModeSchema = z.enum(["interactive", "autonomous"]);
export type InteractionMode = z.infer<typeof interactionModeSchema>;

export const executionModeSchema = z.enum(["foreground", "background"]);
export type ExecutionMode = z.infer<typeof executionModeSchema>;

export const visibilityModeSchema = z.enum(["summary", "debug"]);
export type VisibilityMode = z.infer<typeof visibilityModeSchema>;

export const verificationModeSchema = z.enum(["strict", "normal", "lenient"]);
export type VerificationMode = z.infer<typeof verificationModeSchema>;

export const modeConfigSchema = z.object({
	interactionMode: interactionModeSchema.default("interactive"),
	executionMode: executionModeSchema.default("foreground"),
	visibilityMode: visibilityModeSchema.default("summary"),
	verificationMode: verificationModeSchema.default("normal"),
});

export type ModeConfig = z.infer<typeof modeConfigSchema>;

export const modeDefaults = modeConfigSchema.parse({});

export const verificationCommandSchema = z.object({
	name: z.string().min(1),
	command: z.string().min(1),
});

export const verificationSettingsSchema = z.object({
	commandChecks: z.array(verificationCommandSchema).default([]),
});

export type VerificationSettings = z.infer<typeof verificationSettingsSchema>;

export const projectVerificationConfigSchema = z.object({
	verification: verificationSettingsSchema.default(verificationSettingsSchema.parse({})),
});

export const verificationConfigSchema = z.object({
	commandChecks: z.array(verificationCommandSchema).default([]),
	projectOverrides: z.record(z.string(), verificationSettingsSchema).default({}),
});

export const verificationDefaults = verificationConfigSchema.parse({});

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

type PluginConfigV4 = z.infer<typeof pluginConfigSchemaV4>;

// --- V5 schema ---

const pluginConfigSchemaV5 = z
	.object({
		version: z.literal(5),
		configured: z.boolean(),
		groups: z.record(z.string(), groupModelAssignmentSchema).default({}),
		overrides: z.record(z.string(), agentOverrideSchema).default({}),
		orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
		confidence: confidenceConfigSchema.default(confidenceDefaults),
		fallback: fallbackConfigSchema.default(fallbackDefaults),
		memory: memoryConfigSchema.default(memoryDefaults),
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

type PluginConfigV5 = z.infer<typeof pluginConfigSchemaV5>;

// --- V6 schema ---

const pluginConfigSchemaV6 = z
	.object({
		version: z.literal(6),
		configured: z.boolean(),
		groups: z.record(z.string(), groupModelAssignmentSchema).default({}),
		overrides: z.record(z.string(), agentOverrideSchema).default({}),
		orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
		confidence: confidenceConfigSchema.default(confidenceDefaults),
		fallback: fallbackConfigSchemaV6.default(fallbackDefaultsV6),
		memory: memoryConfigSchema.default(memoryDefaults),
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

type PluginConfigV6 = z.infer<typeof pluginConfigSchemaV6>;

interface LegacyModeInput {
	readonly orchestratorAutonomy?: unknown;
	readonly orchestratorStrictness?: unknown;
	readonly backgroundEnabled?: unknown;
	readonly autonomyEnabled?: unknown;
	readonly routingEnabled?: unknown;
	readonly autonomyVerification?: unknown;
}

function deriveModeFromLegacyInput(input: LegacyModeInput): ModeConfig {
	const autonomyVerificationResult = verificationModeSchema.safeParse(input.autonomyVerification);
	const orchestratorVerificationResult = verificationModeSchema.safeParse(
		input.orchestratorStrictness,
	);
	const verificationMode: VerificationMode = autonomyVerificationResult.success
		? autonomyVerificationResult.data
		: orchestratorVerificationResult.success
			? orchestratorVerificationResult.data
			: modeDefaults.verificationMode;
	const legacyAutonomousIntent = input.orchestratorAutonomy === "full";
	const interactionMode: InteractionMode =
		legacyAutonomousIntent &&
		input.autonomyEnabled === true &&
		input.backgroundEnabled === true &&
		input.routingEnabled === true
			? "autonomous"
			: "interactive";

	return modeConfigSchema.parse({
		interactionMode,
		executionMode: input.backgroundEnabled === true ? "background" : "foreground",
		visibilityMode: modeDefaults.visibilityMode,
		verificationMode,
	});
}

function normalizeV7ConfigInput(rawConfig: unknown): unknown {
	if (!rawConfig || typeof rawConfig !== "object") {
		return rawConfig;
	}

	const rawRecord = rawConfig as Record<string, unknown>;
	if (rawRecord.version !== 7 || "mode" in rawRecord) {
		return rawConfig;
	}

	const orchestrator =
		rawRecord.orchestrator && typeof rawRecord.orchestrator === "object"
			? (rawRecord.orchestrator as Record<string, unknown>)
			: null;
	const background =
		rawRecord.background && typeof rawRecord.background === "object"
			? (rawRecord.background as Record<string, unknown>)
			: null;
	const autonomy =
		rawRecord.autonomy && typeof rawRecord.autonomy === "object"
			? (rawRecord.autonomy as Record<string, unknown>)
			: null;
	const routing =
		rawRecord.routing && typeof rawRecord.routing === "object"
			? (rawRecord.routing as Record<string, unknown>)
			: null;

	return {
		...rawRecord,
		mode: deriveModeFromLegacyInput({
			orchestratorAutonomy: orchestrator?.autonomy,
			orchestratorStrictness: orchestrator?.strictness,
			backgroundEnabled: background?.enabled,
			autonomyEnabled: autonomy?.enabled,
			routingEnabled: routing?.enabled,
			autonomyVerification: autonomy?.verification,
		}),
	};
}

function isV7ConfigMissingMode(rawConfig: unknown): boolean {
	return (
		!!rawConfig &&
		typeof rawConfig === "object" &&
		(rawConfig as Record<string, unknown>).version === 7 &&
		!("mode" in (rawConfig as Record<string, unknown>))
	);
}

const pluginConfigSchemaV7Base = z
	.object({
		version: z.literal(7),
		configured: z.boolean(),
		groups: z.record(z.string(), groupModelAssignmentSchema).default({}),
		overrides: z.record(z.string(), agentOverrideSchema).default({}),
		orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
		confidence: confidenceConfigSchema.default(confidenceDefaults),
		fallback: fallbackConfigSchemaV6.default(fallbackDefaultsV6),
		memory: memoryConfigSchema.default(memoryDefaults),
		notifications: notificationsConfigSchema.optional().default(notificationsDefaults),
		verification: verificationConfigSchema.default(verificationDefaults),
		background: backgroundConfigSchema.default(backgroundDefaults),
		autonomy: z
			.object({
				enabled: z.boolean().default(false),
				verification: z.enum(["strict", "normal", "lenient"]).default("normal"),
				maxIterations: z.number().int().min(1).max(50).default(10),
			})
			.default({ enabled: false, verification: "normal", maxIterations: 10 }),
		mode: modeConfigSchema.default(modeDefaults),
		routing: routingConfigSchema.default(routingDefaults),
		recovery: recoveryConfigSchema.default(recoveryDefaults),
		mcp: mcpConfigSchema.default(mcpDefaults),
		hashline_edit: hashlineEditConfigSchema.default(hashlineEditDefaults),
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

		const modeAnalysis = inspectConfigMode(config);
		for (const issue of modeAnalysis.issues) {
			if (issue.severity !== "error") {
				continue;
			}

			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: [...issue.path],
				message: issue.message,
			});
		}
	});

const pluginConfigSchemaV7 = z.preprocess(normalizeV7ConfigInput, pluginConfigSchemaV7Base);

export const pluginConfigSchema = pluginConfigSchemaV7;

export type PluginConfig = z.infer<typeof pluginConfigSchemaV7>;

export interface ConfigInvariantIssue {
	readonly code: string;
	readonly severity: "error" | "warning";
	readonly message: string;
	readonly path: readonly (string | number)[];
}

export interface ConfigModeAnalysis {
	readonly mode: ModeConfig;
	readonly verificationProfileConfigured: boolean;
	readonly issues: readonly ConfigInvariantIssue[];
	readonly hasErrors: boolean;
}

export const CONFIG_PATH = join(getGlobalConfigDir(), "opencode-autopilot.json");

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

function migrateV3toV4(v3Config: PluginConfigV3): PluginConfigV4 {
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

function migrateV4toV5(v4Config: PluginConfigV4): PluginConfigV5 {
	return {
		version: 5 as const,
		configured: v4Config.configured,
		groups: v4Config.groups,
		overrides: v4Config.overrides,
		orchestrator: v4Config.orchestrator,
		confidence: v4Config.confidence,
		fallback: v4Config.fallback,
		memory: memoryDefaults,
	};
}

function migrateV5toV6(v5Config: PluginConfigV5): PluginConfigV6 {
	return {
		version: 6 as const,
		configured: v5Config.configured,
		groups: v5Config.groups,
		overrides: v5Config.overrides,
		orchestrator: v5Config.orchestrator,
		confidence: v5Config.confidence,
		fallback: { ...v5Config.fallback, testMode: testModeDefaults },
		memory: v5Config.memory,
	};
}

export const v7ConfigDefaults = {
	notifications: notificationsDefaults,
	verification: verificationDefaults,
	background: backgroundDefaults,
	autonomy: {
		enabled: false,
		verification: "normal",
		maxIterations: 10,
	},
	mode: modeDefaults,
	routing: routingDefaults,
	recovery: recoveryDefaults,
	mcp: mcpDefaults,
	hashline_edit: hashlineEditDefaults,
} as const;

export function resolveProjectVerificationSettings(
	config: PluginConfig | null,
	projectRoot: string,
): VerificationSettings | null {
	const projectKey = resolve(projectRoot);
	const projectOverride = config?.verification.projectOverrides[projectKey];
	if (projectOverride && projectOverride.commandChecks.length > 0) {
		return projectOverride;
	}

	if (config?.verification.commandChecks && config.verification.commandChecks.length > 0) {
		return { commandChecks: [...config.verification.commandChecks] };
	}

	return null;
}

function hasConfiguredVerificationProfile(
	config: PluginConfig,
	projectRoot?: string | null,
): boolean {
	if (projectRoot) {
		return resolveProjectVerificationSettings(config, projectRoot) !== null;
	}

	if (config.verification.commandChecks.length > 0) {
		return true;
	}

	return Object.values(config.verification.projectOverrides).some(
		(override) => override.commandChecks.length > 0,
	);
}

function createConfigIssue(
	code: string,
	severity: "error" | "warning",
	path: readonly (string | number)[],
	message: string,
): ConfigInvariantIssue {
	return Object.freeze({ code, severity, path, message });
}

export function inspectConfigMode(
	config: PluginConfig,
	options: { readonly projectRoot?: string | null } = {},
): ConfigModeAnalysis {
	const issues: ConfigInvariantIssue[] = [];
	const verificationProfileConfigured = hasConfiguredVerificationProfile(
		config,
		options.projectRoot,
	);
	const disabledLegacyFlags = [
		!config.autonomy.enabled ? "autonomy.enabled=false" : null,
		!config.background.enabled ? "background.enabled=false" : null,
		!config.routing.enabled ? "routing.enabled=false" : null,
	].filter((value): value is string => value !== null);
	const legacyAutonomousIntent = config.orchestrator.autonomy === "full";

	if (!verificationProfileConfigured) {
		issues.push(
			createConfigIssue(
				"missing_verification_profile",
				config.mode.interactionMode === "autonomous" ? "error" : "warning",
				["verification", "commandChecks"],
				config.mode.interactionMode === "autonomous"
					? "Autonomous mode requires a verification profile with at least one command check."
					: "No verification profile is configured. Autonomous mode will refuse to start until command checks are defined.",
			),
		);
	}

	if (config.mode.interactionMode === "autonomous") {
		if (config.mode.executionMode !== "background") {
			issues.push(
				createConfigIssue(
					"autonomous_requires_background_execution",
					"error",
					["mode", "executionMode"],
					"Autonomous mode requires executionMode=background.",
				),
			);
		}

		if (config.orchestrator.autonomy !== "full") {
			issues.push(
				createConfigIssue(
					"legacy_orchestrator_autonomy_mismatch",
					"error",
					["orchestrator", "autonomy"],
					"Autonomous mode requires orchestrator.autonomy=full for legacy compatibility.",
				),
			);
		}

		if (!config.autonomy.enabled) {
			issues.push(
				createConfigIssue(
					"legacy_autonomy_disabled",
					"error",
					["autonomy", "enabled"],
					"Autonomous mode forbids autonomy.enabled=false.",
				),
			);
		}

		if (!config.background.enabled) {
			issues.push(
				createConfigIssue(
					"legacy_background_disabled",
					"error",
					["background", "enabled"],
					"Autonomous mode forbids background.enabled=false.",
				),
			);
		}

		if (!config.routing.enabled) {
			issues.push(
				createConfigIssue(
					"legacy_routing_disabled",
					"error",
					["routing", "enabled"],
					"Autonomous mode forbids routing.enabled=false.",
				),
			);
		}
	} else if (legacyAutonomousIntent && disabledLegacyFlags.length > 0) {
		issues.push(
			createConfigIssue(
				"disabled_legacy_mode_flags",
				"warning",
				["orchestrator", "autonomy"],
				`Legacy autonomy settings are contradictory (${disabledLegacyFlags.join(", ")}). Canonical mode resolves to ${config.mode.interactionMode}/${config.mode.executionMode}.`,
			),
		);
	}

	return Object.freeze({
		mode: config.mode,
		verificationProfileConfigured,
		issues: Object.freeze(issues),
		hasErrors: issues.some((issue) => issue.severity === "error"),
	});
}

export function migrateV6toV7(v6Config: PluginConfigV6): PluginConfig {
	return {
		version: 7 as const,
		configured: v6Config.configured,
		groups: v6Config.groups,
		overrides: v6Config.overrides,
		orchestrator: v6Config.orchestrator,
		confidence: v6Config.confidence,
		fallback: v6Config.fallback,
		memory: v6Config.memory,
		notifications: notificationsDefaults,
		verification: verificationDefaults,
		background: backgroundDefaults,
		autonomy: {
			enabled: false,
			verification: "normal",
			maxIterations: 10,
		},
		mode: deriveModeFromLegacyInput({
			orchestratorAutonomy: v6Config.orchestrator.autonomy,
			orchestratorStrictness: v6Config.orchestrator.strictness,
		}),
		routing: routingDefaults,
		recovery: recoveryDefaults,
		mcp: mcpDefaults,
		hashline_edit: hashlineEditDefaults,
	};
}

export async function loadConfig(configPath: string = CONFIG_PATH): Promise<PluginConfig | null> {
	try {
		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw);

		const v7Result = pluginConfigSchemaV7.safeParse(parsed);
		if (v7Result.success) {
			if (isV7ConfigMissingMode(parsed)) {
				await saveConfig(v7Result.data, configPath);
			}
			return v7Result.data;
		}

		const v6Result = pluginConfigSchemaV6.safeParse(parsed);
		if (v6Result.success) {
			const migrated = migrateV6toV7(v6Result.data);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		const v5Result = pluginConfigSchemaV5.safeParse(parsed);
		if (v5Result.success) {
			const v6 = migrateV5toV6(v5Result.data);
			const migrated = migrateV6toV7(v6);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		const v4Result = pluginConfigSchemaV4.safeParse(parsed);
		if (v4Result.success) {
			const v5 = migrateV4toV5(v4Result.data);
			const v6 = migrateV5toV6(v5);
			const migrated = migrateV6toV7(v6);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		const v3Result = pluginConfigSchemaV3.safeParse(parsed);
		if (v3Result.success) {
			const v4 = migrateV3toV4(v3Result.data);
			const v5 = migrateV4toV5(v4);
			const v6 = migrateV5toV6(v5);
			const migrated = migrateV6toV7(v6);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		const v2Result = pluginConfigSchemaV2.safeParse(parsed);
		if (v2Result.success) {
			const v3 = migrateV2toV3(v2Result.data);
			const v4 = migrateV3toV4(v3);
			const v5 = migrateV4toV5(v4);
			const v6 = migrateV5toV6(v5);
			const migrated = migrateV6toV7(v6);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		const v1Result = pluginConfigSchemaV1.safeParse(parsed);
		if (v1Result.success) {
			const v2 = migrateV1toV2(v1Result.data);
			const v3 = migrateV2toV3(v2);
			const v4 = migrateV3toV4(v3);
			const v5 = migrateV4toV5(v4);
			const v6 = migrateV5toV6(v5);
			const migrated = migrateV6toV7(v6);
			await saveConfig(migrated, configPath);
			return migrated;
		}

		return pluginConfigSchemaV7.parse(parsed);
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
	const validated = pluginConfigSchema.parse(config);
	const tmpPath = `${configPath}.tmp.${randomBytes(8).toString("hex")}`;
	await writeFile(tmpPath, JSON.stringify(validated, null, 2), "utf-8");
	await rename(tmpPath, configPath);
}

export function isFirstLoad(config: PluginConfig | null): boolean {
	return config === null || !config.configured;
}

export function createDefaultConfig(): PluginConfig {
	return {
		version: 7 as const,
		configured: false,
		groups: {},
		overrides: {},
		confidence: confidenceDefaults,
		fallback: fallbackDefaultsV6,
		memory: memoryDefaults,
		notifications: notificationsDefaults,
		verification: verificationDefaults,
		background: backgroundDefaults,
		autonomy: {
			enabled: false,
			verification: "normal",
			maxIterations: 10,
		},
		mode: {
			interactionMode: "interactive",
			executionMode: "foreground",
			visibilityMode: "summary",
			verificationMode: "normal",
		},
		orchestrator: {
			...orchestratorDefaults,
			autonomy: "supervised",
		},
		routing: routingDefaults,
		recovery: recoveryDefaults,
		mcp: mcpDefaults,
		hashline_edit: hashlineEditDefaults,
	};
}
