/**
 * Typed event emitter helper functions for observability events.
 *
 * Each function constructs a frozen ObservabilityEvent with a timestamp.
 * Pure functions: take args, return frozen event object.
 *
 * @module
 */

import type { ObservabilityEvent } from "./event-store";

/**
 * Constructs a fallback event.
 */
export function emitFallbackEvent(
	sessionId: string,
	failedModel: string,
	nextModel: string,
	reason: string,
	success: boolean,
): ObservabilityEvent {
	return Object.freeze({
		type: "fallback" as const,
		timestamp: new Date().toISOString(),
		sessionId,
		failedModel,
		nextModel,
		reason,
		success,
	});
}

/**
 * Constructs an error event.
 */
export function emitErrorEvent(
	sessionId: string,
	errorType:
		| "rate_limit"
		| "quota_exceeded"
		| "service_unavailable"
		| "missing_api_key"
		| "model_not_found"
		| "content_filter"
		| "context_length"
		| "unknown",
	message: string,
	model = "unknown",
	statusCode?: number,
): ObservabilityEvent {
	return Object.freeze({
		type: "error" as const,
		timestamp: new Date().toISOString(),
		sessionId,
		errorType,
		message,
		model,
		...(statusCode !== undefined ? { statusCode } : {}),
	});
}

/**
 * Constructs a decision event (per D-27, D-28).
 */
export function emitDecisionEvent(
	sessionId: string,
	phase: string,
	agent: string,
	decision: string,
	rationale: string,
): ObservabilityEvent {
	return Object.freeze({
		type: "decision" as const,
		timestamp: new Date().toISOString(),
		sessionId,
		phase,
		agent,
		decision,
		rationale,
	});
}

/**
 * Constructs a model_switch event.
 */
export function emitModelSwitchEvent(
	sessionId: string,
	fromModel: string,
	toModel: string,
	trigger: "fallback" | "config" | "user",
): ObservabilityEvent {
	return Object.freeze({
		type: "model_switch" as const,
		timestamp: new Date().toISOString(),
		sessionId,
		fromModel,
		toModel,
		trigger,
	});
}

/**
 * Constructs a tool_complete event.
 */
export function emitToolCompleteEvent(
	sessionId: string,
	tool: string,
	durationMs: number,
	success: boolean,
): ObservabilityEvent {
	return Object.freeze({
		type: "tool_complete" as const,
		timestamp: new Date().toISOString(),
		sessionId,
		tool,
		durationMs,
		success,
	});
}

/**
 * Constructs a phase_transition event.
 */
export function emitPhaseTransition(
	sessionId: string,
	fromPhase: string,
	toPhase: string,
): ObservabilityEvent {
	return Object.freeze({
		type: "phase_transition" as const,
		timestamp: new Date().toISOString(),
		sessionId,
		fromPhase,
		toPhase,
	});
}
