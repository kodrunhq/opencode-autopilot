import { z } from "zod";

export const ErrorCategorySchema = z.enum([
	"rate_limit",
	"auth_failure",
	"quota_exceeded",
	"service_unavailable",
	"timeout",
	"network",
	"validation",
	"empty_content",
	"thinking_block_error",
	"tool_result_overflow",
	"context_window_exceeded",
	"session_corruption",
	"agent_loop_stuck",
	"unknown",
]);
export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;

export const RecoveryStrategySchema = z.enum([
	"retry",
	"fallback_model",
	"skip",
	"abort",
	"user_prompt",
	"compact_and_retry",
	"restart_session",
	"reduce_context",
	"skip_and_continue",
]);
export type RecoveryStrategy = z.infer<typeof RecoveryStrategySchema>;

export const RecoveryActionSchema = z.object({
	strategy: RecoveryStrategySchema,
	errorCategory: ErrorCategorySchema,
	maxAttempts: z.number().int().min(1).max(10).default(3),
	backoffMs: z.number().int().min(0).default(1000),
	fallbackAgentId: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
});
export type RecoveryAction = z.infer<typeof RecoveryActionSchema>;

export const recoveryConfigSchema = z.object({
	enabled: z.boolean().default(true),
	maxRetries: z.number().int().min(0).max(10).default(3),
});
export type RecoveryConfig = z.infer<typeof recoveryConfigSchema>;
export const recoveryDefaults = recoveryConfigSchema.parse({});
