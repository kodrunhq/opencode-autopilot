import type { FallbackManager } from "./fallback-manager";

/**
 * Factory that creates a tool.execute.after hook handler for subagent result sync.
 *
 * Intercepts "task" tool results (subagent dispatches). When a child session's
 * fallback is still in progress, the task result may be empty. This handler
 * marks such results with a `fallbackPending` metadata flag so the orchestrator
 * knows to retry.
 */
export function createToolExecuteAfterHandler(manager: FallbackManager) {
	return async (
		input: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
		},
		output: { title: string; output: string; metadata: unknown },
	): Promise<void> => {
		// Only intercept 'task' tool results (subagent dispatch results)
		if (input.tool !== "task") return;

		// Check if output is empty (indicates subagent failure mid-fallback)
		if (
			!output.output ||
			output.output.trim() === "" ||
			output.output === "<task_result></task_result>"
		) {
			// Check if child session had a parent
			const parentID = manager.getParentID(input.sessionID);
			if (parentID != null) {
				// Mark for the orchestrator to retry -- the child session's fallback
				// will complete asynchronously. Add metadata flag.
				output.metadata = {
					...(typeof output.metadata === "object" && output.metadata !== null
						? output.metadata
						: {}),
					fallbackPending: true,
				};
			}
		}
	};
}
