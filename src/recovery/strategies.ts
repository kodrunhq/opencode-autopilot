import type { ErrorCategory, RecoveryAction } from "../types/recovery";
import type { RecoveryState } from "./types";

export type RecoveryStrategyResolver = (context: RecoveryState) => RecoveryAction;

function createAction(
	strategy: RecoveryAction["strategy"],
	errorCategory: ErrorCategory,
	maxAttempts: number,
	backoffMs: number,
	metadata: Record<string, unknown> = {},
): RecoveryAction {
	return Object.freeze({
		strategy,
		errorCategory,
		maxAttempts,
		backoffMs,
		metadata,
	});
}

function getAttemptIndex(context: RecoveryState): number {
	return context.attempts.length;
}

function retryWithBackoff(category: ErrorCategory): RecoveryStrategyResolver {
	return (context) => {
		const attemptIndex = getAttemptIndex(context);
		return createAction("retry", category, context.maxAttempts, 1000 * 2 ** attemptIndex, {
			retryMode: "backoff",
		});
	};
}

function fallbackModel(category: ErrorCategory): RecoveryStrategyResolver {
	return (context) =>
		createAction("fallback_model", category, context.maxAttempts, 0, {
			switchModel: true,
		});
}

function compactAndRetry(category: ErrorCategory): RecoveryStrategyResolver {
	return (context) =>
		createAction("compact_and_retry", category, context.maxAttempts, 500, {
			compactContext: true,
		});
}

function restartSession(category: ErrorCategory): RecoveryStrategyResolver {
	return (context) =>
		createAction("restart_session", category, context.maxAttempts, 0, {
			restartSession: true,
		});
}

function reduceContext(category: ErrorCategory): RecoveryStrategyResolver {
	return (context) =>
		createAction("reduce_context", category, context.maxAttempts, 250, {
			trimContext: true,
		});
}

function skipAndContinue(category: ErrorCategory): RecoveryStrategyResolver {
	return (context) =>
		createAction("skip_and_continue", category, context.maxAttempts, 0, {
			skipCurrentStep: true,
		});
}

function userPrompt(category: ErrorCategory): RecoveryStrategyResolver {
	return (context) => createAction("user_prompt", category, context.maxAttempts, 0);
}

function abort(category: ErrorCategory): RecoveryStrategyResolver {
	return (context) => createAction("abort", category, context.maxAttempts, 0);
}

export function getStrategy(category: ErrorCategory): RecoveryStrategyResolver {
	switch (category) {
		case "rate_limit":
		case "timeout":
		case "network":
		case "service_unavailable":
			return retryWithBackoff(category);
		case "quota_exceeded":
		case "empty_content":
		case "thinking_block_error":
			return fallbackModel(category);
		case "tool_result_overflow":
			return compactAndRetry(category);
		case "context_window_exceeded":
			return (context) =>
				getAttemptIndex(context) > 0
					? reduceContext(category)(context)
					: compactAndRetry(category)(context);
		case "session_corruption":
			return restartSession(category);
		case "agent_loop_stuck":
			return skipAndContinue(category);
		case "validation":
			return userPrompt(category);
		case "auth_failure":
			return abort(category);
		default:
			return retryWithBackoff(category);
	}
}
