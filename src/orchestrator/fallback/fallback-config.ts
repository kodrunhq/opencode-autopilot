import { z } from "zod";

export const fallbackConfigSchema = z.object({
	enabled: z.boolean().default(true),
	retryOnErrors: z.array(z.number()).default([401, 402, 429, 500, 502, 503, 504]),
	retryableErrorPatterns: z.array(z.string().max(256)).max(50).default([]),
	maxFallbackAttempts: z.number().min(1).max(100).default(10),
	cooldownSeconds: z.number().min(1).max(3600).default(60),
	timeoutSeconds: z.number().min(0).max(300).default(30),
	notifyOnFallback: z.boolean().default(true),
});

export type FallbackConfig = z.infer<typeof fallbackConfigSchema>;

// Pre-compute defaults for Zod v4 nested default compatibility
export const fallbackDefaults = fallbackConfigSchema.parse({});

// --- Test mode sub-schema (v6) ---

export const testModeSchema = z.object({
	enabled: z.boolean().default(false),
	sequence: z
		.array(z.enum(["rate_limit", "quota_exceeded", "service_unavailable", "malformed", "timeout"]))
		.default([]),
});

export type TestModeConfig = z.infer<typeof testModeSchema>;
export const testModeDefaults = testModeSchema.parse({});

// --- V6 fallback schema (extends base with testMode) ---

export const fallbackConfigSchemaV6 = fallbackConfigSchema.extend({
	testMode: testModeSchema.default(testModeDefaults),
});

export type FallbackConfigV6 = z.infer<typeof fallbackConfigSchemaV6>;
export const fallbackDefaultsV6 = fallbackConfigSchemaV6.parse({});
