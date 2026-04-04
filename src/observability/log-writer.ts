import { getProjectArtifactDir, getProjectRootFromArtifactDir } from "../utils/paths";
import { appendForensicEvent } from "./forensic-log";
import type { ForensicEvent } from "./forensic-types";

export interface WriteSessionInput {
	readonly projectRoot: string;
	readonly sessionId: string;
	readonly startedAt: string;
	readonly endedAt?: string | null;
	readonly events: readonly ForensicEvent[];
}

interface LegacyWriteSessionInput {
	readonly sessionId: string;
	readonly startedAt: string;
	readonly endedAt?: string | null;
	readonly events: readonly ForensicEvent[];
}

export function getLogsDir(projectRoot: string): string {
	return getProjectArtifactDir(projectRoot);
}

export async function writeSessionLog(
	input: WriteSessionInput | LegacyWriteSessionInput,
	projectRootOrArtifactDir?: string,
): Promise<void> {
	const projectRoot =
		"projectRoot" in input
			? input.projectRoot
			: getProjectRootFromArtifactDir(projectRootOrArtifactDir ?? process.cwd());

	for (const event of input.events) {
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
}
