import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { isEnoentError } from "../utils/fs-helpers";
import { getProjectRootFromArtifactDir } from "../utils/paths";
import { readForensicEvents } from "./forensic-log";
import type { ForensicEvent } from "./forensic-types";

export interface SessionDecision {
	readonly timestamp: string | null;
	readonly phase: string;
	readonly agent: string;
	readonly decision: string;
	readonly rationale: string;
}

export interface SessionLog {
	readonly schemaVersion: 1;
	readonly sessionId: string;
	readonly projectRoot: string;
	readonly startedAt: string;
	readonly endedAt: string | null;
	readonly events: readonly ForensicEvent[];
	readonly decisions: readonly SessionDecision[];
	readonly errorSummary: Readonly<Record<string, number>>;
}

export interface SessionLogEntry {
	readonly sessionId: string;
	readonly projectRoot: string;
	readonly startedAt: string;
	readonly endedAt: string | null;
	readonly eventCount: number;
	readonly decisionCount: number;
	readonly errorCount: number;
}

export interface EventSearchFilters {
	readonly type?: string;
	readonly after?: string;
	readonly before?: string;
	readonly domain?: string;
	readonly subsystem?: string;
	/** Matches against event.type for semantic severity (e.g. "error", "warning"),
	 *  or against event.payload.severity / event.payload.level for explicit severity fields. */
	readonly severity?: string;
}

function isSessionForProject(event: Readonly<ForensicEvent>, sessionId: string): boolean {
	return event.domain === "session" && event.sessionId === sessionId;
}

function buildErrorSummary(events: readonly ForensicEvent[]): Readonly<Record<string, number>> {
	const summary: Record<string, number> = {};
	for (const event of events) {
		if (event.type !== "error") {
			continue;
		}
		const code =
			event.code ?? (typeof event.payload.errorType === "string" ? event.payload.errorType : null);
		const key = code ?? "unknown";
		summary[key] = (summary[key] ?? 0) + 1;
	}
	return Object.freeze(summary);
}

function buildDecisions(events: readonly ForensicEvent[]): readonly SessionDecision[] {
	return Object.freeze(
		events
			.filter((event) => event.type === "decision")
			.map((event) => ({
				timestamp: event.timestamp,
				phase: event.phase ?? "UNKNOWN",
				agent: event.agent ?? "unknown",
				decision:
					typeof event.payload.decision === "string"
						? event.payload.decision
						: (event.message ?? "decision recorded"),
				rationale:
					typeof event.payload.rationale === "string"
						? event.payload.rationale
						: (event.message ?? ""),
			})),
	);
}

function buildSessionLog(
	projectRoot: string,
	sessionId: string,
	events: readonly ForensicEvent[],
): SessionLog | null {
	if (events.length === 0) {
		return null;
	}

	const sessionEvents = events
		.filter((event) => event.sessionId === sessionId)
		.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
	if (sessionEvents.length === 0) {
		return null;
	}

	const started = sessionEvents.find((event) => event.type === "session_start");
	const ended = [...sessionEvents].reverse().find((event) => event.type === "session_end");

	return {
		schemaVersion: 1,
		sessionId,
		projectRoot,
		startedAt: started?.timestamp ?? sessionEvents[0].timestamp,
		endedAt: ended?.timestamp ?? null,
		events: Object.freeze(sessionEvents),
		decisions: buildDecisions(sessionEvents),
		errorSummary: buildErrorSummary(sessionEvents),
	};
}

export async function readSessionLog(
	sessionId: string,
	artifactDirOrProjectRoot: string,
): Promise<SessionLog | null> {
	const projectRoot = getProjectRootFromArtifactDir(artifactDirOrProjectRoot);
	const events = await readForensicEvents(projectRoot);
	return buildSessionLog(projectRoot, sessionId, events);
}

export async function listSessionLogs(
	artifactDirOrProjectRoot: string,
): Promise<readonly SessionLogEntry[]> {
	const projectRoot = getProjectRootFromArtifactDir(artifactDirOrProjectRoot);
	const events = await readForensicEvents(projectRoot);
	const sessionIds = [
		...new Set(events.map((event) => event.sessionId).filter((value): value is string => !!value)),
	];

	const entries = sessionIds
		.map((sessionId) => buildSessionLog(projectRoot, sessionId, events))
		.filter((entry): entry is SessionLog => entry !== null)
		.map((log) => ({
			sessionId: log.sessionId,
			projectRoot: log.projectRoot,
			startedAt: log.startedAt,
			endedAt: log.endedAt,
			eventCount: log.events.length,
			decisionCount: log.decisions.length,
			errorCount: Object.values(log.errorSummary).reduce((sum, count) => sum + count, 0),
		}))
		.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

	return Object.freeze(entries);
}

export async function readLatestSessionLog(
	artifactDirOrProjectRoot: string,
): Promise<SessionLog | null> {
	const entries = await listSessionLogs(artifactDirOrProjectRoot);
	if (entries.length === 0) {
		return null;
	}
	return readSessionLog(entries[0].sessionId, artifactDirOrProjectRoot);
}

export function searchEvents(
	events: readonly ForensicEvent[],
	filters: EventSearchFilters,
): readonly ForensicEvent[] {
	return events.filter((event) => {
		if (filters.type && event.type !== filters.type) return false;
		if (filters.domain && event.domain !== filters.domain) return false;
		if (filters.after && event.timestamp <= filters.after) return false;
		if (filters.before && event.timestamp >= filters.before) return false;
		if (filters.subsystem) {
			const subsystem = event.payload.subsystem;
			if (typeof subsystem !== "string" || subsystem !== filters.subsystem) return false;
		}
		if (filters.severity) {
			const payloadSeverity =
				typeof event.payload.severity === "string"
					? event.payload.severity
					: typeof event.payload.level === "string"
						? event.payload.level
						: null;
			const matchesSemantic = event.type === filters.severity;
			const matchesPayload = payloadSeverity === filters.severity;
			if (!matchesSemantic && !matchesPayload) return false;
		}
		return true;
	});
}

export async function listProjectRootsWithLogs(rootDir: string): Promise<readonly string[]> {
	try {
		const entries = await readdir(rootDir, { withFileTypes: true });
		return Object.freeze(
			entries.filter((entry) => entry.isDirectory()).map((entry) => join(rootDir, entry.name)),
		);
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return Object.freeze([]);
		}
		throw error;
	}
}
