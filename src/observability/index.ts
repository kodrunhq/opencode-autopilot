/**
 * Observability module barrel export.
 *
 * Re-exports all public APIs from the session observability system:
 * - Schemas and types for structured forensic events
 * - Forensic log writer/reader for durable project-local evidence
 * - Summary generator for human-readable reports
 * - Retention for time-based pruning
 */

export {
	appendForensicEvent,
	appendForensicEventForArtifactDir,
	createForensicEvent,
	getForensicLogPath,
	readForensicEvents,
} from "./forensic-log";
export {
	forensicEventDefaults,
	forensicEventDomainSchema,
	forensicEventSchema,
	forensicEventTypeSchema,
} from "./forensic-schemas";
export type { EventSearchFilters, SessionLogEntry } from "./log-reader";
export {
	listSessionLogs,
	readLatestSessionLog,
	readSessionLog,
	searchEvents,
} from "./log-reader";
export { getLogsDir, writeSessionLog } from "./log-writer";
export { pruneOldLogs } from "./retention";
export { getLogsDir as getEventLogsDir, getSessionLog, logEvent } from "./session-logger";

export {
	computeDuration,
	formatCost,
	formatDuration,
	generateSessionSummary,
} from "./summary-generator";
export type {
	ForensicEvent,
	ForensicEventDomain,
	ForensicEventType,
	SessionDecision,
	SessionLog,
} from "./types";
