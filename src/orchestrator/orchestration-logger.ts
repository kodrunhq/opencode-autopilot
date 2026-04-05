import { getLogger } from "../logging/domains";
import { createForensicSinkForArtifactDir } from "../logging/forensic-writer";
import type { LogLevel } from "../logging/types";

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

function resolveOperation(event: OrchestrationEvent): string {
	if (event.action === "dispatch") return "dispatch";
	if (event.action === "dispatch_multi") return "dispatch_multi";
	if (event.action === "complete") return "complete";
	if (event.action === "loop_detected") return "loop_detected";
	if (event.action === "error" && event.code?.startsWith("E_")) return "warning";
	return "error";
}

export function logOrchestrationEvent(artifactDir: string, event: OrchestrationEvent): void {
	try {
		const domain =
			event.action === "error" && event.code?.startsWith("E_") ? "contract" : "orchestrator";
		const operation = resolveOperation(event);
		const level: LogLevel = event.action === "error" ? "ERROR" : "INFO";

		const metadata = {
			domain,
			operation,
			runId: event.runId ?? null,
			sessionId: event.sessionId ?? null,
			phase: event.phase,
			dispatchId: event.dispatchId ?? null,
			taskId: event.taskId ?? null,
			agent: event.agent ?? null,
			code: event.code ?? null,
			action: event.action,
			...(event.promptLength !== undefined ? { promptLength: event.promptLength } : {}),
			...(event.attempt !== undefined ? { attempt: event.attempt } : {}),
			...(event.payload ?? {}),
		};

		createForensicSinkForArtifactDir(artifactDir).write(
			Object.freeze({
				timestamp: event.timestamp,
				level,
				message: event.message ?? event.action,
				metadata,
			}),
		);

		const globalLogger = getLogger(domain);
		if (event.action === "error") {
			globalLogger.error(event.message ?? event.action, { operation, phase: event.phase });
		} else {
			globalLogger.info(event.message ?? event.action, { operation, phase: event.phase });
		}
	} catch {}
}
