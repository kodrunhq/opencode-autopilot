/**
 * Dispatch-level retry engine for the orchestration pipeline.
 *
 * Classifies errors from subtask results, decides retry vs fallback,
 * and tracks per-dispatch retry state. Reuses recovery/classifier.ts
 * for error classification and recovery/strategies.ts for strategy selection.
 *
 * Retry state is keyed by `{phase}:{agent}` composite key, NOT by dispatchId.
 * This ensures attempt history persists across redispatches (which create
 * new dispatchIds), so retry limits are actually enforced.
 */

import { getLogger } from "../logging/domains";
import { classifyError } from "../recovery/classifier";
import { getStrategy } from "../recovery/strategies";
import type { ErrorCategory } from "../types/recovery";

const logger = getLogger("orchestrator", "dispatch-retry");

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Regex patterns matching provider/transport errors embedded in result text. */
const DISPATCH_ERROR_PATTERNS: readonly RegExp[] = Object.freeze([
	/\bprovider_unavailable\b/i,
	/\b(?:502|503|504)\b.*(?:bad\s+gateway|service\s+unavailable|gateway\s+timeout)/i,
	/\bnetwork\s+connection\s+lost\b/i,
	/\brate\s*limit/i,
	/\btoo\s+many\s+requests\b/i,
	/\b429\b/,
	/\btimeout\b/i,
	/\btimed?\s*out\b/i,
	/\bECONNRESET\b/i,
	/\bsocket\s+hang\s+up\b/i,
	/\bservice\s+unavailable\b/i,
	/\boverloaded\b/i,
	/\bE_INVALID_RESULT\b/,
	/\btool\s+execution\s+aborted\b/i,
	/\binternal\s+server\s+error\b/i,
]);

// Results shorter than this with an error pattern are almost certainly failures,
// not real agent output that happens to mention an error.
const MIN_MEANINGFUL_RESULT_LENGTH = 120;

export interface DispatchRetryState {
	readonly retryKey: string;
	readonly phase: string;
	readonly agent: string;
	readonly attempts: number;
	readonly maxAttempts: number;
	readonly lastError: string | null;
	readonly lastCategory: ErrorCategory | null;
}

export interface DispatchRetryDecision {
	readonly shouldRetry: boolean;
	readonly backoffMs: number;
	readonly useFallbackModel: boolean;
	readonly errorCategory: ErrorCategory;
	readonly reasoning: string;
}

export function buildRetryKey(phase: string, agent: string): string {
	return `${phase}:${agent}`;
}

const retryStates = new Map<string, DispatchRetryState>();

/**
 * Detect whether a result payload indicates a dispatch failure.
 * Returns the extracted error string if detected, null otherwise.
 */
export function detectDispatchFailure(resultText: string): string | null {
	if (!resultText || resultText.trim().length === 0) {
		return "empty result payload";
	}

	const trimmed = resultText.trim();

	// Try parsing as JSON — handles both single-line and multiline JSON error payloads
	try {
		const parsed = JSON.parse(trimmed) as Record<string, unknown>;
		if (parsed.error || parsed.code || parsed.status === "error") {
			const errorMsg =
				typeof parsed.error === "string"
					? parsed.error
					: typeof parsed.message === "string"
						? parsed.message
						: typeof parsed.code === "string"
							? parsed.code
							: JSON.stringify(parsed);
			return errorMsg;
		}
	} catch {
		// Not clean JSON — check if a JSON error is embedded within larger text
		const jsonMatch = trimmed.match(/\{[^{}]*"(?:error|code|status)"[^{}]*\}/);
		if (jsonMatch) {
			try {
				const embedded = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
				if (embedded.error || embedded.code || embedded.status === "error") {
					const errorMsg =
						typeof embedded.error === "string"
							? embedded.error
							: typeof embedded.message === "string"
								? embedded.message
								: typeof embedded.code === "string"
									? embedded.code
									: jsonMatch[0];
					return errorMsg;
				}
			} catch {
				// embedded JSON parse failed — fall through
			}
		}
	}

	if (trimmed.length < MIN_MEANINGFUL_RESULT_LENGTH) {
		for (const pattern of DISPATCH_ERROR_PATTERNS) {
			if (pattern.test(trimmed)) {
				return trimmed;
			}
		}
	}

	// Check first line for error patterns — only flag if total output is short
	// (indicating the agent never produced real output after the error)
	const firstLine = trimmed.split("\n")[0] ?? "";
	if (firstLine.length < 200) {
		for (const pattern of DISPATCH_ERROR_PATTERNS) {
			if (pattern.test(firstLine) && trimmed.length < MIN_MEANINGFUL_RESULT_LENGTH * 4) {
				return firstLine;
			}
		}
	}

	return null;
}

/**
 * Decide whether a failed dispatch should be retried, using the
 * recovery classifier to categorize the error and select a strategy.
 */
export function decideRetry(
	dispatchId: string,
	phase: string,
	agent: string,
	errorText: string,
	maxRetries: number = 2,
): DispatchRetryDecision {
	const classification = classifyError(errorText);
	const key = buildRetryKey(phase, agent);
	const state = retryStates.get(key);
	const attempts = state?.attempts ?? 0;

	if (!classification.isRecoverable) {
		logger.info("Non-recoverable dispatch error", {
			dispatchId,
			phase,
			agent,
			category: classification.category,
		});
		return Object.freeze({
			shouldRetry: false,
			backoffMs: 0,
			useFallbackModel: false,
			errorCategory: classification.category,
			reasoning: `Non-recoverable error: ${classification.category}`,
		});
	}

	if (attempts >= maxRetries) {
		logger.info("Dispatch retry limit reached", {
			dispatchId,
			retryKey: key,
			phase,
			agent,
			attempts,
			maxRetries,
		});
		return Object.freeze({
			shouldRetry: false,
			backoffMs: 0,
			useFallbackModel: false,
			errorCategory: classification.category,
			reasoning: `Retry limit reached (${attempts}/${maxRetries}) for ${classification.category}`,
		});
	}

	const mockState = {
		sessionId: dispatchId,
		attempts: Array.from({ length: attempts }, (_, i) => ({
			attemptNumber: i + 1,
			strategy: "retry" as const,
			errorCategory: classification.category,
			timestamp: new Date().toISOString(),
			success: false,
		})),
		currentStrategy: null,
		maxAttempts: maxRetries,
		isRecovering: false,
		lastError: errorText,
	};
	const action = getStrategy(classification.category)(mockState);

	const RETRYABLE_STRATEGIES = new Set([
		"retry",
		"fallback_model",
		"compact_and_retry",
		"reduce_context",
	]);

	if (!RETRYABLE_STRATEGIES.has(action.strategy)) {
		logger.info("Strategy does not support dispatch retry", {
			dispatchId,
			retryKey: key,
			phase,
			agent,
			category: classification.category,
			strategy: action.strategy,
		});
		return Object.freeze({
			shouldRetry: false,
			backoffMs: 0,
			useFallbackModel: false,
			errorCategory: classification.category,
			reasoning: `Strategy "${action.strategy}" does not support retry for ${classification.category}`,
		});
	}

	const useFallback =
		action.strategy === "fallback_model" || (action.strategy === "retry" && attempts > 0);

	const backoffMs = action.backoffMs > 0 ? action.backoffMs : 1000 * 2 ** attempts;

	logger.info("Dispatch retry decision", {
		dispatchId,
		retryKey: key,
		phase,
		agent,
		category: classification.category,
		strategy: action.strategy,
		attempts: attempts + 1,
		maxRetries,
		useFallback,
		backoffMs,
	});

	return Object.freeze({
		shouldRetry: true,
		backoffMs,
		useFallbackModel: useFallback,
		errorCategory: classification.category,
		reasoning: `${classification.category}: ${action.strategy} (attempt ${attempts + 1}/${maxRetries})`,
	});
}

export function recordRetryAttempt(
	_dispatchId: string,
	phase: string,
	agent: string,
	errorCategory: ErrorCategory,
	errorText: string | null = null,
): void {
	const key = buildRetryKey(phase, agent);
	const existing = retryStates.get(key);
	const nextState: DispatchRetryState = Object.freeze({
		retryKey: key,
		phase,
		agent,
		attempts: (existing?.attempts ?? 0) + 1,
		maxAttempts: existing?.maxAttempts ?? 2,
		lastError: errorText,
		lastCategory: errorCategory,
	});
	retryStates.set(key, nextState);
}

export function clearRetryStateByKey(phase: string, agent: string): void {
	retryStates.delete(buildRetryKey(phase, agent));
}

export function clearAllRetryState(): void {
	retryStates.clear();
}

export function getRetryState(keyOrDispatchId: string): DispatchRetryState | null {
	return retryStates.get(keyOrDispatchId) ?? null;
}

export function getRetryStateByKey(phase: string, agent: string): DispatchRetryState | null {
	return retryStates.get(buildRetryKey(phase, agent)) ?? null;
}

/**
 * Build a failure summary for the orchestrating agent when retries are exhausted.
 * Structured so the orchestrator can parse the failure and decide how to proceed.
 */
export function buildFailureSummary(
	dispatchId: string,
	phase: string,
	agent: string,
	errorText: string,
	category: ErrorCategory,
	attempts: number,
): string {
	return [
		`DISPATCH_FAILED: Agent "${agent}" failed in phase ${phase}.`,
		`Error category: ${category}`,
		`Attempts: ${attempts}`,
		`Error: ${errorText.slice(0, 500)}`,
		`Dispatch ID: ${dispatchId}`,
		"",
		"The orchestrator should either skip this dispatch and proceed,",
		"or report the failure to the user.",
	].join("\n");
}
