import type { FallbackConfig } from "./fallback-config";
import type { FallbackManager } from "./fallback-manager";
import { replayWithDegradation } from "./message-replay";
import type { MessagePart } from "./types";

/**
 * SDK operations interface for dependency injection.
 * Enables testing without the OpenCode runtime.
 */
export interface SdkOperations {
	readonly abortSession: (sessionID: string) => Promise<void>;
	readonly getSessionMessages: (sessionID: string) => Promise<readonly MessagePart[]>;
	readonly promptAsync: (
		sessionID: string,
		model: { readonly providerID: string; readonly modelID: string },
		parts: readonly MessagePart[],
	) => Promise<void>;
	readonly showToast: (
		title: string,
		message: string,
		variant: "info" | "warning" | "error",
	) => Promise<void>;
}

export interface EventHandlerDeps {
	readonly manager: FallbackManager;
	readonly sdk: SdkOperations;
	readonly config: FallbackConfig;
}

/**
 * Parses a "provider/model" string into { providerID, modelID }.
 * Splits on the first "/" only. Returns null if no "/" found.
 */
export function parseModelString(
	model: string,
): { readonly providerID: string; readonly modelID: string } | null {
	const slashIndex = model.indexOf("/");
	if (slashIndex <= 0) return null;
	return {
		providerID: model.slice(0, slashIndex),
		modelID: model.slice(slashIndex + 1),
	};
}

/**
 * Extracts a session ID from event properties.
 * Supports both `properties.sessionID` and `properties.info.sessionID`.
 */
function extractSessionID(properties: Record<string, unknown>): string | undefined {
	if (typeof properties.sessionID === "string") return properties.sessionID;
	if (
		properties.info !== null &&
		typeof properties.info === "object" &&
		typeof (properties.info as Record<string, unknown>).sessionID === "string"
	) {
		return (properties.info as Record<string, unknown>).sessionID as string;
	}
	return undefined;
}

/**
 * Factory that creates an event handler function bound to fallback dependencies.
 * The returned handler routes OpenCode events to the FallbackManager.
 */
export function createEventHandler(deps: EventHandlerDeps) {
	const { manager, sdk, config } = deps;

	return async (input: {
		readonly event: { readonly type: string; readonly [key: string]: unknown };
	}): Promise<void> => {
		const { event } = input;
		const properties = (event.properties ?? {}) as Record<string, unknown>;

		switch (event.type) {
			case "session.created": {
				const info = properties.info as
					| { id?: string; model?: string; parentID?: string | null }
					| undefined;
				if (!info?.id) return;

				const model = typeof info.model === "string" ? info.model : "";
				const parentID = info.parentID !== undefined ? info.parentID : undefined;
				manager.initSession(info.id, model, parentID);

				// Start TTFT timeout if model present and timeout configured
				if (model && config.timeoutSeconds > 0) {
					manager.startTtftTimeout(info.id, () => {
						// On TTFT timeout, abort session to trigger fallback via session.error
						sdk.abortSession(info.id as string).catch(() => {
							// Best-effort abort; session.error will handle the result
						});
					});
				}
				return;
			}

			case "session.deleted": {
				const info = properties.info as { id?: string } | undefined;
				if (info?.id) {
					manager.cleanupSession(info.id);
				}
				return;
			}

			case "session.compacted": {
				const sessionID = extractSessionID(properties);
				if (sessionID) {
					manager.clearCompactionInFlight(sessionID);
				}
				return;
			}

			case "message.part.delta":
			case "session.diff": {
				const sessionID = extractSessionID(properties);
				if (sessionID) {
					manager.recordFirstToken(sessionID);
				}
				return;
			}

			case "session.error": {
				const sessionID =
					typeof properties.sessionID === "string" ? properties.sessionID : undefined;
				if (!sessionID) return;

				const error = properties.error;
				const modelStr = typeof properties.model === "string" ? properties.model : undefined;

				await handleFallbackError(manager, sdk, config, sessionID, error, modelStr);
				return;
			}

			case "message.updated": {
				const info = properties.info as
					| { sessionID?: string; error?: unknown; model?: string }
					| undefined;
				if (!info?.sessionID || !info.error) return;

				const modelStr = typeof info.model === "string" ? info.model : undefined;
				await handleFallbackError(manager, sdk, config, info.sessionID, info.error, modelStr);
				return;
			}

			default:
				// Unknown event type -- ignore
				return;
		}
	};
}

/**
 * Shared fallback error handling logic used by both session.error and message.updated.
 */
async function handleFallbackError(
	manager: FallbackManager,
	sdk: SdkOperations,
	config: FallbackConfig,
	sessionID: string,
	error: unknown,
	modelStr?: string,
): Promise<void> {
	// Pitfall 2: Suppress self-abort errors
	if (manager.isSelfAbortError(sessionID)) return;

	// Pitfall 5: Suppress stale errors from previous models
	if (manager.isStaleError(sessionID, modelStr)) return;

	// Delegate to manager's guard chain (retryable check, lock, state, plan)
	const plan = manager.handleError(sessionID, error, modelStr);
	if (!plan) return;

	try {
		// Record self-abort before aborting (Pitfall 2)
		manager.recordSelfAbort(sessionID);

		// Abort current request
		await sdk.abortSession(sessionID);

		// Get messages for replay
		const messages = await sdk.getSessionMessages(sessionID);

		// Get current state for attempt-based degradation
		const state = manager.getSessionState(sessionID);
		const attemptCount = state?.attemptCount ?? 0;
		const { parts: replayedParts } = replayWithDegradation(messages, attemptCount);

		// Commit fallback state
		manager.commitAndUpdateState(sessionID, plan);

		// Parse the new model for the SDK call
		const parsedModel = parseModelString(plan.newModel);
		if (parsedModel) {
			// Notify user if enabled
			if (config.notifyOnFallback) {
				await sdk
					.showToast(
						"Model Fallback",
						`Switching from ${plan.failedModel} to ${plan.newModel}: ${plan.reason}`,
						"warning",
					)
					.catch(() => {
						// Best-effort notification
					});
			}

			// Dispatch replay with fallback model
			await sdk.promptAsync(sessionID, parsedModel, replayedParts);
		}

		// Release lock after successful dispatch
		manager.releaseRetryLock(sessionID);
	} catch {
		// On failure, release the lock to allow future retries
		manager.releaseRetryLock(sessionID);
	}
}
