/**
 * Hook handler factories for OpenCode event system integration.
 *
 * Creates handlers for:
 * - event hook: session.created/error/idle/deleted/compacted, message.updated
 * - tool.execute.before: records start timestamp
 * - tool.execute.after: computes duration, records metrics
 *
 * All handlers are pure observers: they read event data, append to store,
 * and never modify session state or output objects (Pitfall 5).
 *
 * @module
 */

import {
	classifyErrorType,
	getErrorMessage,
	isRetryableError,
} from "../orchestrator/fallback/error-classifier";
import type { ContextMonitor } from "./context-monitor";
import { emitErrorEvent, emitToolCompleteEvent } from "./event-emitter";
import type { ObservabilityEvent, SessionEventStore, SessionEvents } from "./event-store";
import { accumulateTokensFromMessage, createEmptyTokenAggregate } from "./token-tracker";

/**
 * Dependencies for the observability event handler.
 */
export interface ObservabilityHandlerDeps {
	readonly eventStore: SessionEventStore;
	readonly contextMonitor: ContextMonitor;
	readonly showToast: (
		title: string,
		message: string,
		variant: "info" | "warning" | "error",
	) => Promise<void>;
	readonly writeSessionLog: (sessionData: SessionEvents | undefined) => Promise<void>;
	readonly retryOnErrors: readonly number[];
}

/**
 * Extracts a session ID from event properties.
 * Supports properties.sessionID, properties.info.sessionID, and properties.info.id.
 */
function extractSessionID(properties: Record<string, unknown>): string | undefined {
	if (typeof properties.sessionID === "string") return properties.sessionID;
	if (properties.info !== null && typeof properties.info === "object") {
		const info = properties.info as Record<string, unknown>;
		if (typeof info.sessionID === "string") return info.sessionID;
		if (typeof info.id === "string") return info.id;
	}
	return undefined;
}

/**
 * Checks if an object has AssistantMessage token shape.
 */
function hasTokenShape(obj: unknown): obj is {
	tokens: {
		input: number;
		output: number;
		reasoning: number;
		cache: { read: number; write: number };
	};
	cost: number;
} {
	if (obj === null || typeof obj !== "object") return false;
	const o = obj as Record<string, unknown>;
	if (typeof o.cost !== "number") return false;
	if (o.tokens === null || typeof o.tokens !== "object") return false;
	const tokens = o.tokens as Record<string, unknown>;
	return (
		typeof tokens.input === "number" &&
		typeof tokens.output === "number" &&
		tokens.cache !== null &&
		typeof tokens.cache === "object"
	);
}

/**
 * Creates the main observability event handler.
 *
 * Routes OpenCode events to the session event store:
 * - session.created: init session, append session_start
 * - session.error: classify error, append error event (D-37, D-38)
 * - message.updated: accumulate tokens, check context utilization
 * - session.idle: flush to disk (fire-and-forget, Pitfall 2)
 * - session.deleted: final flush + cleanup
 * - session.compacted: append event, intermediate flush
 */
export function createObservabilityEventHandler(deps: ObservabilityHandlerDeps) {
	const { eventStore, contextMonitor, showToast, writeSessionLog, retryOnErrors } = deps;

	return async (input: {
		readonly event: { readonly type: string; readonly [key: string]: unknown };
	}): Promise<void> => {
		const { event } = input;
		const properties = (event.properties ?? {}) as Record<string, unknown>;

		switch (event.type) {
			case "session.created": {
				const info = properties.info as { id?: string; model?: string } | undefined;
				if (!info?.id) return;

				eventStore.initSession(info.id);

				// Init context monitor with a default context limit.
				// The actual limit would come from provider metadata if available.
				contextMonitor.initSession(info.id, 200000);

				// Append session_start event
				const startEvent: ObservabilityEvent = Object.freeze({
					type: "session_start" as const,
					timestamp: new Date().toISOString(),
					sessionID: info.id,
				});
				eventStore.appendEvent(info.id, startEvent);
				return;
			}

			case "session.error": {
				const sessionID =
					typeof properties.sessionID === "string" ? properties.sessionID : undefined;
				if (!sessionID) return;

				const error = properties.error;
				const errorType = classifyErrorType(error);
				const message = getErrorMessage(error);
				const retryable = isRetryableError(error, retryOnErrors);

				const errorEvent = emitErrorEvent(sessionID, errorType, message, retryable);
				eventStore.appendEvent(sessionID, errorEvent);
				return;
			}

			case "message.updated": {
				const info = properties.info as Record<string, unknown> | undefined;
				if (!info) return;

				const sessionID = typeof info.sessionID === "string" ? info.sessionID : undefined;
				if (!sessionID) return;

				// Accumulate tokens if message has AssistantMessage shape
				if (hasTokenShape(info)) {
					const empty = createEmptyTokenAggregate();
					const accumulated = accumulateTokensFromMessage(empty, info);
					eventStore.accumulateTokens(sessionID, accumulated);

					// Check context utilization
					const utilResult = contextMonitor.processMessage(sessionID, info.tokens.input);
					if (utilResult.shouldWarn) {
						const pct = Math.round(utilResult.utilization * 100);
						// Append context_warning event
						const warningEvent: ObservabilityEvent = Object.freeze({
							type: "context_warning" as const,
							timestamp: new Date().toISOString(),
							sessionID,
							utilization: utilResult.utilization,
							contextLimit: 200000,
							inputTokens: info.tokens.input,
						});
						eventStore.appendEvent(sessionID, warningEvent);

						// Fire toast (per D-35)
						showToast(
							"Context Warning",
							`Context at ${pct}% -- consider compacting`,
							"warning",
						).catch(() => {
							// Best-effort toast
						});
					}
				}
				return;
			}

			case "session.idle": {
				const sessionID = extractSessionID(properties);
				if (!sessionID) return;

				// Flush to disk (fire-and-forget per Pitfall 2)
				const sessionData = eventStore.flush(sessionID);
				writeSessionLog(sessionData).catch(() => {
					// Best-effort write
				});
				return;
			}

			case "session.deleted": {
				const sessionID = extractSessionID(properties);
				if (!sessionID) return;

				// Final flush
				const sessionData = eventStore.flush(sessionID);
				writeSessionLog(sessionData).catch(() => {
					// Best-effort write
				});

				// Clean up context monitor
				contextMonitor.cleanup(sessionID);
				return;
			}

			case "session.compacted": {
				const sessionID = extractSessionID(properties);
				if (!sessionID) return;

				// Append compaction event
				const compactEvent: ObservabilityEvent = Object.freeze({
					type: "session_start" as const,
					timestamp: new Date().toISOString(),
					sessionID,
				});
				eventStore.appendEvent(sessionID, compactEvent);

				// Intermediate flush
				const sessionData = eventStore.flush(sessionID);
				writeSessionLog(sessionData).catch(() => {});
				return;
			}

			default:
				return;
		}
	};
}

/**
 * Creates a tool.execute.before handler that records start timestamps.
 *
 * @param startTimes - Map to store callID -> start timestamp
 */
export function createToolExecuteBeforeHandler(startTimes: Map<string, number>) {
	return (hookInput: {
		readonly tool: string;
		readonly sessionID: string;
		readonly callID: string;
		readonly args: unknown;
	}): void => {
		startTimes.set(hookInput.callID, Date.now());
	};
}

/**
 * Determines if a tool execution succeeded based on the output.
 */
function isToolSuccess(output: {
	readonly title: string;
	readonly output: string;
	readonly metadata: unknown;
}): boolean {
	// Check metadata for explicit error flag
	if (output.metadata !== null && typeof output.metadata === "object") {
		const meta = output.metadata as Record<string, unknown>;
		if (meta.error === true) return false;
	}
	// Check title for error indicator
	if (output.title.toLowerCase().startsWith("error")) return false;
	// Check output for error prefix
	if (output.output.startsWith("Error:")) return false;
	return true;
}

/**
 * Creates a tool.execute.after handler that computes duration and records metrics.
 *
 * Never modifies the output object (pure observer per Pitfall 5).
 *
 * @param eventStore - The session event store
 * @param startTimes - Map of callID -> start timestamp (shared with before handler)
 */
export function createToolExecuteAfterHandler(
	eventStore: SessionEventStore,
	startTimes: Map<string, number>,
) {
	return (
		hookInput: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
		},
		output: { readonly title: string; readonly output: string; readonly metadata: unknown },
	): void => {
		const startTime = startTimes.get(hookInput.callID);
		const durationMs = startTime !== undefined ? Date.now() - startTime : 0;
		const success = isToolSuccess(output);

		// Clean up start time entry
		startTimes.delete(hookInput.callID);

		// Record tool execution metric (per D-39, D-40)
		eventStore.recordToolExecution(hookInput.sessionID, hookInput.tool, durationMs, success);

		// Append tool_complete event
		const toolEvent = emitToolCompleteEvent(
			hookInput.sessionID,
			hookInput.tool,
			durationMs,
			success,
		);
		eventStore.appendEvent(hookInput.sessionID, toolEvent);
	};
}
