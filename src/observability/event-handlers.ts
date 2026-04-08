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

import { getLogger } from "../logging/domains";
import { classifyErrorType, getErrorMessage } from "../orchestrator/fallback/error-classifier";
import { generateSessionSummary } from "../ux/session-summary";
import { getContextUtilizationString } from "./context-display";
import type { ContextMonitor } from "./context-monitor";
import { globalCostTracker } from "./cost-tracker";
import { emitErrorEvent, emitToolCompleteEvent } from "./event-emitter";
import type { ObservabilityEvent, SessionEventStore, SessionEvents } from "./event-store";
import { accumulateTokensFromMessage, createEmptyTokenAggregate } from "./token-tracker";

const logger = getLogger("session", "event-handlers");

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
}

/**
 * Extracts a session ID from event properties.
 * Supports properties.sessionID, properties.info.sessionID, and properties.info.id.
 */
function extractSessionId(properties: Record<string, unknown>): string | undefined {
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
	if (typeof tokens.input !== "number") return false;
	if (typeof tokens.output !== "number") return false;
	if (typeof tokens.reasoning !== "number") return false;
	if (tokens.cache === null || typeof tokens.cache !== "object") return false;
	const cache = tokens.cache as Record<string, unknown>;
	return typeof cache.read === "number" && typeof cache.write === "number";
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
	const { eventStore, contextMonitor, showToast, writeSessionLog } = deps;

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
					sessionId: info.id,
				});
				eventStore.appendEvent(info.id, startEvent);
				return;
			}

			case "session.error": {
				const sessionId = extractSessionId(properties);
				if (!sessionId) return;

				const error = properties.error;
				const rawErrorType = classifyErrorType(error);
				const errorType = (
					[
						"rate_limit",
						"quota_exceeded",
						"service_unavailable",
						"missing_api_key",
						"model_not_found",
						"content_filter",
						"context_length",
					] as const
				).includes(rawErrorType as never)
					? (rawErrorType as
							| "rate_limit"
							| "quota_exceeded"
							| "service_unavailable"
							| "missing_api_key"
							| "model_not_found"
							| "content_filter"
							| "context_length")
					: ("unknown" as const);
				const message = getErrorMessage(error);

				const errorEvent = emitErrorEvent(sessionId, errorType, message);
				eventStore.appendEvent(sessionId, errorEvent);
				return;
			}

			case "message.updated": {
				const info = properties.info as Record<string, unknown> | undefined;
				if (!info) return;

				const sessionId = typeof info.sessionID === "string" ? info.sessionID : undefined;
				if (!sessionId) return;

				// Accumulate tokens if message has AssistantMessage shape
				if (hasTokenShape(info)) {
					const empty = createEmptyTokenAggregate();
					const accumulated = accumulateTokensFromMessage(empty, info);
					eventStore.accumulateTokens(sessionId, accumulated);

					const agent = (info as Record<string, unknown>).agent;
					const model = (info as Record<string, unknown>).model;
					globalCostTracker.recordCost({
						timestamp: new Date().toISOString(),
						sessionId,
						agent: typeof agent === "string" ? agent : "unknown",
						model: typeof model === "string" ? model : undefined,
						operation: "message",
						inputTokens: info.tokens.input,
						outputTokens: info.tokens.output,
						totalTokens:
							accumulated.inputTokens + accumulated.outputTokens + accumulated.reasoningTokens,
					});

					// Check context utilization
					const utilResult = contextMonitor.processMessage(sessionId, info.tokens.input);
					if (utilResult.shouldWarn) {
						// Append context_warning event
						const warningEvent: ObservabilityEvent = Object.freeze({
							type: "context_warning" as const,
							timestamp: new Date().toISOString(),
							sessionId,
							utilization: utilResult.utilization,
							contextLimit: 200000,
							inputTokens: info.tokens.input,
						});
						eventStore.appendEvent(sessionId, warningEvent);

						// Fire toast (per D-35)
						showToast(
							"Context Warning",
							getContextUtilizationString(info.tokens.input, 200000),
							"warning",
						).catch((err) => {
							logger.error("showToast failed for context warning", {
								operation: "context_warning",
								sessionId,
								error: String(err),
							});
						});
					}
				}
				return;
			}

			case "session.idle": {
				const sessionId = extractSessionId(properties);
				if (!sessionId) return;

				// Persist only new events since the last flush.
				const sessionData = eventStore.getUnpersistedSession(sessionId);
				if (sessionData && sessionData.events.length > 0) {
					writeSessionLog(sessionData).catch((err) => {
						logger.error("writeSessionLog failed on session.idle", {
							operation: "session_end",
							sessionId,
							error: String(err),
						});
					});
				}
				return;
			}

			case "session.deleted": {
				const sessionId = extractSessionId(properties);
				if (!sessionId) return;

				const session = eventStore.getSession(sessionId);
				const now = new Date();
				const startedAt = session?.startedAt ? new Date(session.startedAt) : now;
				const durationMs = Math.max(0, now.getTime() - startedAt.getTime());
				const totalCost = session?.tokens?.totalCost ?? 0;

				eventStore.appendEvent(sessionId, {
					type: "session_end",
					timestamp: now.toISOString(),
					sessionId,
					durationMs,
					totalCost,
				});

				const summary = generateSessionSummary(eventStore.getSession(sessionId), null);
				logger.info(`Session ended summary:\n${summary}`, {
					operation: "session_end",
					sessionId,
				});

				void showToast(
					"Session ended",
					"Run /oc_summary to view the session summary.",
					"info",
				).catch((err) => {
					logger.error("showToast failed for session end", {
						operation: "session_end",
						sessionId,
						error: String(err),
					});
				});

				// Final flush — session is done, remove from store
				const sessionData = eventStore.flush(sessionId);
				if (sessionData && sessionData.events.length > 0) {
					writeSessionLog(sessionData).catch((err) => {
						logger.error("writeSessionLog failed on session.deleted", {
							operation: "session_end",
							sessionId,
							error: String(err),
						});
					});
				}

				// Clean up context monitor
				contextMonitor.cleanup(sessionId);
				return;
			}

			case "session.compacted": {
				const sessionId = extractSessionId(properties);
				if (!sessionId) return;

				// Append compaction decision event (not session_start)
				const compactEvent: ObservabilityEvent = Object.freeze({
					type: "compacted" as const,
					timestamp: new Date().toISOString(),
					sessionId,
					trigger: "context_window",
				});
				eventStore.appendEvent(sessionId, compactEvent);

				// Snapshot to disk — session continues after compaction
				const sessionData = eventStore.getUnpersistedSession(sessionId);
				if (sessionData && sessionData.events.length > 0) {
					writeSessionLog(sessionData).catch((err) => {
						logger.error("writeSessionLog failed on session.compacted", {
							operation: "compacted",
							sessionId,
							error: String(err),
						});
					});
				}
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
