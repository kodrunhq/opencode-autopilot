/**
 * Observability module barrel export.
 *
 * @module
 */

// Context monitor (Plan 02)
export type { ContextUtilizationResult } from "./context-monitor";
export { ContextMonitor, checkContextUtilization } from "./context-monitor";
// Event emitters (Plan 02)
export {
	emitDecisionEvent,
	emitErrorEvent,
	emitFallbackEvent,
	emitModelSwitchEvent,
	emitPhaseTransition,
	emitToolCompleteEvent,
} from "./event-emitter";
// Event handlers (Plan 02)
export type { ObservabilityHandlerDeps } from "./event-handlers";
export {
	createObservabilityEventHandler,
	createToolExecuteAfterHandler,
	createToolExecuteBeforeHandler,
} from "./event-handlers";
// Event store (Plan 02)
export type {
	ObservabilityEvent,
	SessionEvents,
	ToolMetrics,
} from "./event-store";
export { SessionEventStore } from "./event-store";
// Retention (Plan 01)
export { pruneOldLogs } from "./retention";
export { loggingConfigSchema, loggingDefaults, sessionEventSchema } from "./schemas";
// Session logger (Plan 01)
export { getLogsDir, getSessionLog, logEvent } from "./session-logger";
// Token tracker (Plan 02)
export type { AssistantMessageTokens, TokenAggregate } from "./token-tracker";
export {
	accumulateTokens,
	accumulateTokensFromMessage,
	createEmptyTokenAggregate,
} from "./token-tracker";
// Types and schemas (Plan 01)
export type { LoggingConfig, SessionEvent } from "./types";
