import { z } from "zod";

export const baseEventSchema = z.object({
	timestamp: z.string().max(128),
	sessionId: z.string().max(256),
	type: z.enum(["fallback", "error", "decision", "model_switch"]),
});

export const fallbackEventSchema = baseEventSchema.extend({
	type: z.literal("fallback"),
	failedModel: z.string().max(256),
	nextModel: z.string().max(256),
	reason: z.string().max(1024),
	success: z.boolean(),
});

export const errorEventSchema = baseEventSchema.extend({
	type: z.literal("error"),
	errorType: z.enum([
		"rate_limit",
		"quota_exceeded",
		"service_unavailable",
		"missing_api_key",
		"model_not_found",
		"content_filter",
		"context_length",
		"unknown",
	]),
	model: z.string().max(256),
	message: z.string().max(4096),
	statusCode: z.number().optional(),
});

export const decisionEventSchema = baseEventSchema.extend({
	type: z.literal("decision"),
	phase: z.string().max(128),
	agent: z.string().max(128),
	decision: z.string().max(2048),
	rationale: z.string().max(2048),
});

export const modelSwitchEventSchema = baseEventSchema.extend({
	type: z.literal("model_switch"),
	fromModel: z.string().max(256),
	toModel: z.string().max(256),
	trigger: z.enum(["fallback", "config", "user"]),
});

export const sessionEventSchema = z.discriminatedUnion("type", [
	fallbackEventSchema,
	errorEventSchema,
	decisionEventSchema,
	modelSwitchEventSchema,
]);

export const loggingConfigSchema = z.object({
	enabled: z.boolean().default(true),
	retentionDays: z.number().min(1).max(365).default(30),
});

// Pre-compute defaults for Zod v4 nested default compatibility
export const loggingDefaults = loggingConfigSchema.parse({});
