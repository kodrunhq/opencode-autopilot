import { getLogger } from "../../logging/domains";
import { appendForensicEvent } from "../../observability/forensic-log";
import type { FallbackConfig } from "./fallback-config";
import type { FallbackManager } from "./fallback-manager";
import { replayWithDegradation } from "./message-replay";
import type { MessagePart } from "./types";

const logger = getLogger("orchestrator", "fallback-event-handler");

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
	readonly onFallbackEvent?: (event: {
		readonly type: "fallback" | "model_switch";
		readonly sessionId: string;
		readonly failedModel?: string;
		readonly nextModel?: string;
		readonly reason?: string;
		readonly success?: boolean;
		readonly fromModel?: string;
		readonly toModel?: string;
		readonly trigger?: "fallback" | "config" | "user";
	}) => void;
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
	const { manager, sdk, config, onFallbackEvent } = deps;

	return async (input: {
		readonly event: { readonly type: string; readonly [key: string]: unknown };
	}): Promise<void> => {
		const { event } = input;
		const properties = (event.properties ?? {}) as Record<string, unknown>;

		switch (event.type) {
			case "session.created": {
				const info = properties.info as
					| { id?: string; model?: string; parentID?: string | null; agent?: string }
					| undefined;
				if (!info?.id) return;

				const model = typeof info.model === "string" ? info.model : "";
				const parentID = info.parentID !== undefined ? info.parentID : undefined;
				const agentName = typeof info.agent === "string" ? info.agent : undefined;
				manager.initSession(info.id, model, parentID, agentName);

				// Start TTFT timeout only when fallback is enabled and timeout configured.
				// Without a fallback chain, a TTFT abort would just fail the session.
				if (model && config.enabled && config.timeoutSeconds > 0) {
					manager.startTtftTimeout(info.id, () => {
						// Guard: skip if session was cleaned up before timer fires
						if (!manager.getSessionState(info.id as string)) return;
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
					manager.clearAwaitingResult(sessionID);
				}
				return;
			}

			case "session.error": {
				const sessionID =
					typeof properties.sessionID === "string" ? properties.sessionID : undefined;
				if (!sessionID) return;

				const error = properties.error;
				const modelStr = typeof properties.model === "string" ? properties.model : undefined;

				await handleFallbackError(
					manager,
					sdk,
					config,
					sessionID,
					error,
					modelStr,
					onFallbackEvent,
				);
				return;
			}

			case "message.updated": {
				const info = properties.info as
					| { sessionID?: string; error?: unknown; model?: string }
					| undefined;
				if (!info?.sessionID || !info.error) return;

				const modelStr = typeof info.model === "string" ? info.model : undefined;
				await handleFallbackError(
					manager,
					sdk,
					config,
					info.sessionID,
					info.error,
					modelStr,
					onFallbackEvent,
				);
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
	onFallbackEvent?: EventHandlerDeps["onFallbackEvent"],
): Promise<void> {
	// All guards (self-abort, stale, retryable, lock) are inside manager.handleError
	const plan = manager.handleError(sessionID, error, modelStr);
	if (!plan) return;

	try {
		// Record self-abort before aborting (Pitfall 2)
		manager.recordSelfAbort(sessionID);

		// Abort current request
		await sdk.abortSession(sessionID);

		// Session may have been cleaned up during await — verify before continuing
		if (!manager.getSessionState(sessionID)) {
			manager.releaseRetryLock(sessionID);
			return;
		}

		// Get messages for replay
		const messages = await sdk.getSessionMessages(sessionID);

		// Session existence check after second await
		if (!manager.getSessionState(sessionID)) {
			manager.releaseRetryLock(sessionID);
			return;
		}

		// Get current state for attempt-based degradation
		const state = manager.getSessionState(sessionID);
		const attemptCount = state?.attemptCount ?? 0;
		const { parts: replayedParts } = replayWithDegradation(messages, attemptCount);

		// Commit fallback state — abort dispatch if commit fails (stale plan)
		const committed = manager.commitAndUpdateState(sessionID, plan);
		if (!committed) {
			manager.releaseRetryLock(sessionID);
			return;
		}

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

			onFallbackEvent?.({
				type: "fallback",
				sessionId: sessionID,
				failedModel: plan.failedModel,
				nextModel: plan.newModel,
				reason: plan.reason,
				success: true,
			});
			onFallbackEvent?.({
				type: "model_switch",
				sessionId: sessionID,
				fromModel: plan.failedModel,
				toModel: plan.newModel,
				trigger: "fallback",
			});

			// Dispatch replay with fallback model
			await sdk.promptAsync(sessionID, parsedModel, replayedParts);
			// Mark awaiting result inside dispatch block — only when prompt was sent
			manager.markAwaitingResult(sessionID);
			try {
				appendForensicEvent(process.cwd(), {
					projectRoot: process.cwd(),
					domain: "fallback",
					type: "model_switch",
					sessionId: sessionID,
					code: "FALLBACK_SUCCESS",
					message: `Switched from ${plan.failedModel} to ${plan.newModel}: ${plan.reason}`,
					payload: {
						failedModel: plan.failedModel,
						newModel: plan.newModel,
						reason: plan.reason,
					},
				});
			} catch {}
		}

		// Release lock after dispatch (or skip if model unparseable)
		manager.releaseRetryLock(sessionID);
	} catch (error: unknown) {
		// On failure, release the lock to allow future retries
		logger.warn("fallback replay failed", {
			operation: "fallback",
			sessionId: sessionID,
			failedModel: plan.failedModel,
			nextModel: plan.newModel,
			reason: plan.reason,
			error: error instanceof Error ? error.message : String(error),
		});
		try {
			appendForensicEvent(process.cwd(), {
				projectRoot: process.cwd(),
				domain: "fallback",
				type: "error",
				sessionId: sessionID,
				code: "FALLBACK_REPLAY_FAILED",
				message: `Fallback replay failed: ${error instanceof Error ? error.message : String(error)}`,
				payload: {
					failedModel: plan.failedModel,
					newModel: plan.newModel,
					reason: plan.reason,
				},
			});
		} catch {}
		manager.releaseRetryLock(sessionID);
	}
}
