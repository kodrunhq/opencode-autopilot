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
