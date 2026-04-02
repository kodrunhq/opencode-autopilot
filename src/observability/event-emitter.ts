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
	sessionID: string,
	failedModel: string,
	nextModel: string,
	errorType: string,
	success: boolean,
): ObservabilityEvent {
	return Object.freeze({
		type: "fallback" as const,
		timestamp: new Date().toISOString(),
		sessionID,
		failedModel,
		nextModel,
		errorType,
		success,
	});
}

/**
 * Constructs an error event.
 */
export function emitErrorEvent(
	sessionID: string,
	errorType: string,
	message: string,
	retryable: boolean,
	model?: string,
): ObservabilityEvent {
	return Object.freeze({
		type: "error" as const,
		timestamp: new Date().toISOString(),
		sessionID,
		errorType,
		message,
		retryable,
		...(model !== undefined ? { model } : {}),
	});
}

/**
 * Constructs a decision event (per D-27, D-28).
 */
export function emitDecisionEvent(
	sessionID: string,
	phase: string,
	agent: string,
	decision: string,
	rationale: string,
	confidence: string,
): ObservabilityEvent {
	return Object.freeze({
		type: "decision" as const,
		timestamp: new Date().toISOString(),
		sessionID,
		phase,
		agent,
		decision,
		rationale,
		confidence,
	});
}

/**
 * Constructs a model_switch event.
 */
export function emitModelSwitchEvent(
	sessionID: string,
	fromModel: string,
	toModel: string,
	reason: string,
): ObservabilityEvent {
	return Object.freeze({
		type: "model_switch" as const,
		timestamp: new Date().toISOString(),
		sessionID,
		fromModel,
		toModel,
		reason,
	});
}

/**
 * Constructs a tool_complete event.
 */
export function emitToolCompleteEvent(
	sessionID: string,
	tool: string,
	durationMs: number,
	success: boolean,
): ObservabilityEvent {
	return Object.freeze({
		type: "tool_complete" as const,
		timestamp: new Date().toISOString(),
		sessionID,
		tool,
		durationMs,
		success,
	});
}

/**
 * Constructs a phase_transition event.
 */
export function emitPhaseTransition(
	sessionID: string,
	fromPhase: string,
	toPhase: string,
	confidence?: string,
): ObservabilityEvent {
	return Object.freeze({
		type: "phase_transition" as const,
		timestamp: new Date().toISOString(),
		sessionID,
		fromPhase,
		toPhase,
		...(confidence !== undefined ? { confidence } : {}),
	});
}
