import {
	appendForensicEvent,
	appendForensicEventForArtifactDir,
} from "../observability/forensic-log";
import type { ForensicEventDomain, ForensicEventType } from "../observability/forensic-types";
import type { LogEntry, LogSink } from "./types";

export function createForensicSinkForArtifactDir(artifactDir: string): LogSink {
	return {
		write(entry: LogEntry): void {
			const {
				domain,
				operation,
				runId,
				sessionId,
				parentSessionId,
				phase,
				dispatchId,
				taskId,
				agent,
				code,
				subsystem,
				...payload
			} = entry.metadata;

			let forensicDomain: ForensicEventDomain = "system";
			if (
				domain === "session" ||
				domain === "orchestrator" ||
				domain === "contract" ||
				domain === "system" ||
				domain === "review"
			) {
				forensicDomain = domain;
			}

			let forensicType: ForensicEventType = "info";

			if (operation && isValidForensicType(operation as string)) {
				forensicType = operation as ForensicEventType;
			} else {
				switch (entry.level) {
					case "ERROR":
						forensicType = "error";
						break;
					case "WARN":
						forensicType = "warning";
						break;
					case "INFO":
						forensicType = "info";
						break;
					case "DEBUG":
						forensicType = "debug";
						break;
				}
			}

			appendForensicEventForArtifactDir(artifactDir, {
				timestamp: entry.timestamp,
				domain: forensicDomain,
				runId: (runId as string) ?? null,
				sessionId: (sessionId as string) ?? null,
				parentSessionId: (parentSessionId as string) ?? null,
				phase: (phase as string) ?? null,
				dispatchId: (dispatchId as string) ?? null,
				taskId: (taskId as number) ?? null,
				agent: (agent as string) ?? null,
				type: forensicType,
				code: (code as string) ?? null,
				message: entry.message,
				payload: {
					...payload,
					...(subsystem ? { subsystem } : {}),
				} as Record<string, string | number | boolean | object | readonly unknown[] | null>,
			});
		},
	};
}

export function createForensicSink(projectRoot: string): LogSink {
	return {
		write(entry: LogEntry): void {
			const {
				domain,
				operation,
				runId,
				sessionId,
				parentSessionId,
				phase,
				dispatchId,
				taskId,
				agent,
				code,
				subsystem,
				...payload
			} = entry.metadata;

			let forensicDomain: ForensicEventDomain = "system";
			if (
				domain === "session" ||
				domain === "orchestrator" ||
				domain === "contract" ||
				domain === "system" ||
				domain === "review"
			) {
				forensicDomain = domain;
			}

			let forensicType: ForensicEventType = "info";

			if (operation && isValidForensicType(operation as string)) {
				forensicType = operation as ForensicEventType;
			} else {
				switch (entry.level) {
					case "ERROR":
						forensicType = "error";
						break;
					case "WARN":
						forensicType = "warning";
						break;
					case "INFO":
						forensicType = "info";
						break;
					case "DEBUG":
						forensicType = "debug";
						break;
				}
			}

			appendForensicEvent(projectRoot, {
				timestamp: entry.timestamp,
				projectRoot,
				domain: forensicDomain,
				runId: (runId as string) ?? null,
				sessionId: (sessionId as string) ?? null,
				parentSessionId: (parentSessionId as string) ?? null,
				phase: (phase as string) ?? null,
				dispatchId: (dispatchId as string) ?? null,
				taskId: (taskId as number) ?? null,
				agent: (agent as string) ?? null,
				type: forensicType,
				code: (code as string) ?? null,
				message: entry.message,
				payload: {
					...payload,
					...(subsystem ? { subsystem } : {}),
				} as Record<string, string | number | boolean | object | readonly unknown[] | null>,
			});
		},
	};
}

function isValidForensicType(type: string): boolean {
	const validTypes = [
		"run_started",
		"dispatch",
		"dispatch_multi",
		"result_applied",
		"phase_transition",
		"complete",
		"decision",
		"error",
		"loop_detected",
		"failure_recorded",
		"warning",
		"session_start",
		"session_end",
		"fallback",
		"model_switch",
		"context_warning",
		"tool_complete",
		"compacted",
		"info",
		"debug",
	];
	return validTypes.includes(type);
}
