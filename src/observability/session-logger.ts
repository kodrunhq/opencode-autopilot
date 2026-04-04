import { getProjectRootFromArtifactDir } from "../utils/paths";
import { appendForensicEvent, readForensicEvents } from "./forensic-log";
import type { ForensicEvent } from "./forensic-types";

export function getLogsDir(projectRoot: string): string {
	return projectRoot;
}

export async function logEvent(
	event: ForensicEvent,
	artifactDirOrProjectRoot?: string,
): Promise<void> {
	const projectRoot = artifactDirOrProjectRoot
		? getProjectRootFromArtifactDir(artifactDirOrProjectRoot)
		: event.projectRoot;

	appendForensicEvent(projectRoot, {
		timestamp: event.timestamp,
		projectRoot,
		domain: event.domain,
		runId: event.runId,
		sessionId: event.sessionId,
		parentSessionId: event.parentSessionId,
		phase: event.phase,
		dispatchId: event.dispatchId,
		taskId: event.taskId,
		agent: event.agent,
		type: event.type,
		code: event.code,
		message: event.message,
		payload: event.payload,
	});
}

export async function getSessionLog(
	sessionId: string,
	artifactDirOrProjectRoot: string,
): Promise<readonly ForensicEvent[]> {
	const projectRoot = getProjectRootFromArtifactDir(artifactDirOrProjectRoot);
	const events = await readForensicEvents(projectRoot);
	return Object.freeze(events.filter((event) => event.sessionId === sessionId));
}
