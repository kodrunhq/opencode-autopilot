import { z } from "zod";
import {
	confidenceConfigSchema,
	confidenceDefaults,
	memoryConfigSchema,
	memoryDefaults,
	orchestratorConfigSchema,
	orchestratorDefaults,
} from "../config";
import {
	fallbackConfigSchema,
	fallbackDefaults,
	testModeDefaults,
} from "../orchestrator/fallback/fallback-config";
import { AGENT_REGISTRY, ALL_GROUP_IDS } from "../registry/model-groups";

export const pluginConfigSchemaV1 = z.object({
	version: z.literal(1),
	configured: z.boolean(),
	models: z.record(z.string(), z.string()),
});

export type PluginConfigV1 = z.infer<typeof pluginConfigSchemaV1>;

export const pluginConfigSchemaV2 = z.object({
	version: z.literal(2),
	configured: z.boolean(),
	models: z.record(z.string(), z.string()),
	orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
	confidence: confidenceConfigSchema.default(confidenceDefaults),
});

export type PluginConfigV2 = z.infer<typeof pluginConfigSchemaV2>;

export const pluginConfigSchemaV3 = z.object({
	version: z.literal(3),
	configured: z.boolean(),
	models: z.record(z.string(), z.string()),
	orchestrator: orchestratorConfigSchema.default(orchestratorDefaults),
	confidence: confidenceConfigSchema.default(confidenceDefaults),
	fallback: fallbackConfigSchema.default(fallbackDefaults),
	fallback_models: z.union([z.string(), z.array(z.string())]).optional(),
});

export type PluginConfigV3 = z.infer<typeof pluginConfigSchemaV3>;

const groupModelAssignmentSchema = z.object({
	primary: z.string().min(1),
	fallbacks: z.array(z.string().min(1)).default([]),
});

const agentOverrideSchema = z.object({
	primary: z.string().min(1),
	fallbacks: z.array(z.string().min(1)).optional(),
});

export const pluginConfigSchemaV4 = z
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

export type PluginConfigV4 = z.infer<typeof pluginConfigSchemaV4>;

export const pluginConfigSchemaV5 = z
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

export type PluginConfigV5 = z.infer<typeof pluginConfigSchemaV5>;

export function migrateV1toV2(v1Config: PluginConfigV1): PluginConfigV2 {
	return {
		version: 2 as const,
		configured: v1Config.configured,
		models: v1Config.models,
		orchestrator: orchestratorDefaults,
		confidence: confidenceDefaults,
	};
}

export function migrateV2toV3(v2Config: PluginConfigV2): PluginConfigV3 {
	return {
		version: 3 as const,
		configured: v2Config.configured,
		models: v2Config.models,
		orchestrator: v2Config.orchestrator,
		confidence: v2Config.confidence,
		fallback: fallbackDefaults,
	};
}

export function migrateV3toV4(v3Config: PluginConfigV3): PluginConfigV4 {
	const groups: Record<string, { primary: string; fallbacks: string[] }> = {};
	const overrides: Record<string, { primary: string }> = {};

	for (const [agentName, modelId] of Object.entries(v3Config.models)) {
		const entry = AGENT_REGISTRY[agentName];
		if (!entry) {
			overrides[agentName] = { primary: modelId };
			continue;
		}

		const groupId = entry.group;
		if (!groups[groupId]) {
			groups[groupId] = { primary: modelId, fallbacks: [] };
		} else if (groups[groupId].primary !== modelId) {
			overrides[agentName] = { primary: modelId };
		}
	}

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

export function migrateV4toV5(v4Config: PluginConfigV4): PluginConfigV5 {
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

export function migrateV5toV6(
	v5Config: PluginConfigV5,
	fallbackDefaultsV6: typeof fallbackDefaults,
) {
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
