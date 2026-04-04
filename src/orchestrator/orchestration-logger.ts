import { appendForensicEventForArtifactDir } from "../observability/forensic-log";

export interface OrchestrationEvent {
	readonly timestamp: string;
	readonly phase: string;
	readonly action: "dispatch" | "dispatch_multi" | "complete" | "error" | "loop_detected";
	readonly agent?: string;
	readonly promptLength?: number;
	readonly attempt?: number;
	readonly message?: string;
	readonly runId?: string;
	readonly dispatchId?: string;
	readonly taskId?: number | null;
	readonly code?: string;
	readonly sessionId?: string;
	readonly payload?: Record<string, string | number | boolean | null>;
}

/**
 * Append an orchestration event to the project-local JSONL log.
 * Uses synchronous append to survive crashes. Best-effort — errors are swallowed.
 */
export function logOrchestrationEvent(artifactDir: string, event: OrchestrationEvent): void {
	appendForensicEventForArtifactDir(artifactDir, {
		timestamp: event.timestamp,
		domain: event.action === "error" && event.code?.startsWith("E_") ? "contract" : "orchestrator",
		runId: event.runId ?? null,
		sessionId: event.sessionId ?? null,
		phase: event.phase,
		dispatchId: event.dispatchId ?? null,
		taskId: event.taskId ?? null,
		agent: event.agent ?? null,
		type:
			event.action === "dispatch"
				? "dispatch"
				: event.action === "dispatch_multi"
					? "dispatch_multi"
					: event.action === "complete"
						? "complete"
						: event.action === "loop_detected"
							? "loop_detected"
							: event.action === "error" && event.code?.startsWith("E_")
								? "warning"
								: "error",
		code: event.code ?? null,
		message: event.message ?? null,
		payload: {
			action: event.action,
			...(event.promptLength !== undefined ? { promptLength: event.promptLength } : {}),
			...(event.attempt !== undefined ? { attempt: event.attempt } : {}),
			...(event.payload ?? {}),
		},
	});
}
