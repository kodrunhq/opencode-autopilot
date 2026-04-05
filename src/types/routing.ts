import { z } from "zod";

export const CategorySchema = z.enum([
	"quick",
	"visual-engineering",
	"ultrabrain",
	"artistry",
	"writing",
	"unspecified-high",
	"unspecified-low",
]);
export type Category = z.infer<typeof CategorySchema>;

export const CategoryConfigSchema = z.object({
	enabled: z.boolean().default(true),
	agentId: z.string().optional(),
	modelGroup: z.string().optional(),
	maxTokenBudget: z.number().int().min(1000).optional(),
	timeoutSeconds: z.number().int().min(1).max(3600).optional(),
	skills: z.array(z.string()).default([]),
	metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CategoryConfig = z.infer<typeof CategoryConfigSchema>;

export const RoutingDecisionSchema = z.object({
	category: CategorySchema,
	confidence: z.number().min(0).max(1),
	agentId: z.string().optional(),
	reasoning: z.string().optional(),
	appliedConfig: CategoryConfigSchema.optional(),
});
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

export const routingConfigSchema = z.object({
	enabled: z.boolean().default(false),
	categories: z.record(z.string(), CategoryConfigSchema).default({}),
});
export type RoutingConfig = z.infer<typeof routingConfigSchema>;
export const routingDefaults = routingConfigSchema.parse({});
