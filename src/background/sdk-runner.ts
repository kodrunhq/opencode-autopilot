import { getLogger } from "../logging/domains";
import { summarizeBackgroundDescription } from "../ux/visibility";
import type { BackgroundTaskRecord } from "./database";

export interface BackgroundSdkOperations {
	readonly promptAsync: (
		sessionId: string,
		model: string | undefined,
		parts: ReadonlyArray<{ type: "text"; text: string }>,
		agent?: string,
	) => Promise<void>;
}

const logger = getLogger("background", "sdk-runner");

export function createSdkRunner(
	sdk: BackgroundSdkOperations,
): (task: BackgroundTaskRecord, signal: AbortSignal) => Promise<string> {
	return async (task, signal) => {
		if (signal.aborted) {
			throw signal.reason ?? new Error("Aborted");
		}

		const model = task.model ?? undefined;
		const parts: ReadonlyArray<{ type: "text"; text: string }> = [
			{ type: "text", text: task.description },
		];

		logger.info("Dispatching background task via SDK", {
			backgroundTaskId: task.id,
			sessionId: task.sessionId,
			agent: task.agent,
			model: task.model,
		});

		await sdk.promptAsync(task.sessionId, model, parts, task.agent ?? undefined);

		const agentLabel = task.agent ? ` via ${task.agent}` : "";
		const modelLabel = task.model ? ` (${task.model})` : "";
		const taskSummary = summarizeBackgroundDescription(task.description, 72);
		return `Background task dispatched${agentLabel}${modelLabel}. ${taskSummary.length > 0 ? `Summary: ${taskSummary}. ` : ""}Prompt delivered to child session.`;
	};
}
