import { createForensicEvent } from "../../src/observability/forensic-log";
import { writeSessionLog } from "../../src/observability/log-writer";
import type { SessionDecision } from "../../src/observability/types";

export function makeDecisionEvent(
	projectRoot: string,
	sessionId: string,
	timestamp: string,
	decision: SessionDecision,
) {
	return createForensicEvent({
		projectRoot,
		domain: "session",
		timestamp,
		sessionId,
		phase: decision.phase,
		agent: decision.agent,
		type: "decision",
		payload: {
			decision: decision.decision,
			rationale: decision.rationale,
		},
	});
}

export function makeErrorEvent(
	projectRoot: string,
	sessionId: string,
	timestamp: string,
	errorType: string,
	message: string,
	model: string,
) {
	return createForensicEvent({
		projectRoot,
		domain: "session",
		timestamp,
		sessionId,
		type: "error",
		code: errorType,
		message,
		payload: { errorType, model },
	});
}

export async function writeForensicSession(params: {
	readonly projectRoot: string;
	readonly sessionId: string;
	readonly startedAt: string;
	readonly endedAt?: string | null;
	readonly events?: readonly ReturnType<typeof createForensicEvent>[];
	readonly decisions?: readonly SessionDecision[];
}) {
	const sessionStartEvent = createForensicEvent({
		projectRoot: params.projectRoot,
		domain: "session",
		timestamp: params.startedAt,
		sessionId: params.sessionId,
		type: "session_start",
	});
	const sessionEndEvent = params.endedAt
		? [
				createForensicEvent({
					projectRoot: params.projectRoot,
					domain: "session",
					timestamp: params.endedAt,
					sessionId: params.sessionId,
					type: "session_end",
				}),
			]
		: [];
	const decisionEvents = (params.decisions ?? []).map((decision, index) =>
		makeDecisionEvent(
			params.projectRoot,
			params.sessionId,
			`${params.startedAt.slice(0, 16)}:${String(index).padStart(2, "0")}Z`.replace("::", ":"),
			decision,
		),
	);
	await writeSessionLog({
		projectRoot: params.projectRoot,
		sessionId: params.sessionId,
		startedAt: params.startedAt,
		endedAt: params.endedAt,
		events: [sessionStartEvent, ...(params.events ?? []), ...decisionEvents, ...sessionEndEvent],
	});
}
