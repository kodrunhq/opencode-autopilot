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
import { detectDispatchFailure } from "./dispatch-error-detection";

export { detectDispatchFailure };

const logger = getLogger("orchestrator", "dispatch-retry");

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * Decide whether a failed dispatch should be retried, using the
 * recovery classifier to categorize the error and select a strategy.
 *
 * `persistedAttempts` is the retry count from PipelineState.retryAttempts,
 * which survives process restarts. When provided, the effective attempt count
 * is the max of in-memory and persisted values, ensuring restarts don't
 * reset the retry counter.
 */
export function decideRetry(
	dispatchId: string,
	phase: string,
	agent: string,
	errorText: string,
	maxRetries: number = 2,
	persistedAttempts: number = 0,
): DispatchRetryDecision {
	const classification = classifyError(errorText);
	const key = buildRetryKey(phase, agent);
	const state = retryStates.get(key);
	const inMemoryAttempts = state?.attempts ?? 0;
	const attempts = Math.max(inMemoryAttempts, persistedAttempts);

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
): number {
	const key = buildRetryKey(phase, agent);
	const existing = retryStates.get(key);
	const newAttempts = (existing?.attempts ?? 0) + 1;
	const nextState: DispatchRetryState = Object.freeze({
		retryKey: key,
		phase,
		agent,
		attempts: newAttempts,
		maxAttempts: existing?.maxAttempts ?? 2,
		lastError: errorText,
		lastCategory: errorCategory,
	});
	retryStates.set(key, nextState);
	return newAttempts;
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

/**
 * Read the persisted retry attempt count from PipelineState for a given
 * phase:agent composite key. Returns 0 if no retry state exists.
 */
export function getPersistedRetryAttempts(
	retryAttempts: Readonly<Record<string, number>>,
	phase: string,
	agent: string,
): number {
	return retryAttempts[buildRetryKey(phase, agent)] ?? 0;
}

/**
 * Produce a new retryAttempts record with the given phase:agent key
 * set to `count`. Returns a new object (immutable pattern).
 */
export function setPersistedRetryAttempts(
	retryAttempts: Readonly<Record<string, number>>,
	phase: string,
	agent: string,
	count: number,
): Record<string, number> {
	return { ...retryAttempts, [buildRetryKey(phase, agent)]: count };
}

/**
 * Produce a new retryAttempts record with the given phase:agent key
 * removed. Returns a new object (immutable pattern).
 */
export function clearPersistedRetryAttempts(
	retryAttempts: Readonly<Record<string, number>>,
	phase: string,
	agent: string,
): Record<string, number> {
	const key = buildRetryKey(phase, agent);
	if (!(key in retryAttempts)) return retryAttempts as Record<string, number>;
	const { [key]: _, ...rest } = retryAttempts;
	return rest;
}
