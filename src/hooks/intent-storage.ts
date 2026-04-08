/**
 * Hook handler for storing intent classification from oc_route tool.
 * Called from tool.execute.after hook when oc_route succeeds.
 */

import { getLogger } from "../logging/domains";
import { storeIntentClassification } from "../routing/intent-gate";

const logger = getLogger("hooks", "intent-storage");

/**
 * Creates a tool.execute.after handler that stores intent classification
 * from successful oc_route calls.
 */
export function createIntentStorageHandler() {
	return async (
		hookInput: {
			readonly tool: string;
			readonly sessionID: string;
			readonly callID: string;
			readonly args: unknown;
		},
		output: { readonly title: string; readonly output: string; readonly metadata: unknown },
	): Promise<void> => {
		// Only handle oc_route tool
		if (hookInput.tool !== "oc_route") {
			return;
		}

		// Check if tool execution succeeded
		const success = isToolSuccess(output);
		if (!success) {
			logger.debug("oc_route failed, not storing intent", { sessionID: hookInput.sessionID });
			return;
		}

		// Parse the output to extract intent
		try {
			const result = JSON.parse(output.output);
			if (result.action === "route" && result.primaryIntent) {
				const intent = result.primaryIntent;
				storeIntentClassification(hookInput.sessionID, intent);
				logger.debug("Intent classification stored", {
					sessionID: hookInput.sessionID,
					intent,
				});
			}
		} catch (error) {
			logger.warn("Failed to parse oc_route output for intent storage", {
				sessionID: hookInput.sessionID,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};
}

/**
 * Determines if a tool execution succeeded based on the output.
 * Copied from observability/event-handlers.ts.
 */
function isToolSuccess(output: {
	readonly title: string;
	readonly output: string;
	readonly metadata: unknown;
}): boolean {
	// Check metadata for explicit error flag
	if (output.metadata !== null && typeof output.metadata === "object") {
		const meta = output.metadata as Record<string, unknown>;
		if (meta.error === true) return false;
	}
	// Check title for error indicator
	if (output.title.toLowerCase().startsWith("error")) return false;
	// Check output for error prefix
	if (output.output.startsWith("Error:")) return false;
	return true;
}
