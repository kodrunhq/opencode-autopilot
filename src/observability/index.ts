/**
 * Observability module barrel export.
 *
 * Re-exports all public APIs from the session observability system:
 * - Schemas and types for structured events
 * - Session logger for event capture (JSONL append)
 * - Log writer for complete session persistence (atomic JSON)
 * - Log reader for querying persisted sessions
 * - Summary generator for human-readable markdown reports
 * - Retention for time-based log pruning
 */

export type { EventSearchFilters, SessionLogEntry } from "./log-reader";
export {
	listSessionLogs,
	readLatestSessionLog,
	readSessionLog,
	searchEvents,
} from "./log-reader";
export { convertToSessionLog, getLogsDir, writeSessionLog } from "./log-writer";
export { pruneOldLogs } from "./retention";
export {
	baseEventSchema,
	decisionEventSchema,
	errorEventSchema,
	fallbackEventSchema,
	loggingConfigSchema,
	loggingDefaults,
	modelSwitchEventSchema,
	sessionDecisionSchema,
	sessionEventSchema,
	sessionLogSchema,
} from "./schemas";
export { getLogsDir as getEventLogsDir, getSessionLog, logEvent } from "./session-logger";

export {
	computeDuration,
	formatCost,
	formatDuration,
	generateSessionSummary,
} from "./summary-generator";
export type {
	BaseEvent,
	DecisionEvent,
	ErrorEvent,
	FallbackEvent,
	LoggingConfig,
	ModelSwitchEvent,
	SessionDecision,
	SessionEvent,
	SessionEventType,
	SessionLog,
} from "./types";
