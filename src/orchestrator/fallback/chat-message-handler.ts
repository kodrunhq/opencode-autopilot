import { parseModelString } from "./event-handler";
import type { FallbackManager } from "./fallback-manager";

/**
 * Factory that creates a chat.message hook handler bound to the FallbackManager.
 *
 * When a fallback model is active, overrides `output.message.model` so OpenCode
 * sends the request to the fallback provider/model instead of the original.
 *
 * NOTE: The mutation of `output.message.model` is INTENTIONAL -- the OpenCode
 * hook API requires mutating the output object to override the model. This is
 * the one place where mutation is correct (same pattern as configHook mutating
 * config.agent).
 */
export function createChatMessageHandler(manager: FallbackManager) {
	return async (
		input: {
			readonly sessionID: string;
			readonly model?: { readonly providerID: string; readonly modelID: string };
		},
		output: {
			message: { model?: { providerID: string; modelID: string } };
			parts: unknown[];
		},
	): Promise<void> => {
		const state = manager.getSessionState(input.sessionID);
		if (!state) return;

		// Skip if plugin is actively managing a fallback dispatch (Pitfall 3)
		if (manager.isDispatchInFlight(input.sessionID)) return;

		// Skip during compaction
		if (manager.isCompactionInFlight(input.sessionID)) return;

		// Auto-recovery check: revert to original model if cooldown expired
		manager.tryRecoverToOriginal(input.sessionID);
		const currentState = manager.getSessionState(input.sessionID);
		if (!currentState) return;

		// If on primary model, nothing to override
		if (currentState.currentModel === currentState.originalModel) return;

		// Override outgoing model to fallback model
		const parsed = parseModelString(currentState.currentModel);
		if (parsed) {
			output.message.model = { providerID: parsed.providerID, modelID: parsed.modelID };
		}
	};
}
