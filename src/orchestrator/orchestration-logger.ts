import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface OrchestrationEvent {
	readonly timestamp: string;
	readonly phase: string;
	readonly action: "dispatch" | "dispatch_multi" | "complete" | "error" | "loop_detected";
	readonly agent?: string;
	readonly promptLength?: number;
	readonly attempt?: number;
	readonly message?: string;
}

const LOG_FILE = "orchestration.jsonl";

/**
 * Append an orchestration event to the project-local JSONL log.
 * Uses synchronous append to survive crashes. Best-effort — errors are swallowed.
 */
export function logOrchestrationEvent(artifactDir: string, event: OrchestrationEvent): void {
	try {
		mkdirSync(artifactDir, { recursive: true });
		const logPath = join(artifactDir, LOG_FILE);
		const line = `${JSON.stringify(event)}\n`;
		appendFileSync(logPath, line, "utf-8");
	} catch {
		// Best-effort — never block the pipeline
	}
}
