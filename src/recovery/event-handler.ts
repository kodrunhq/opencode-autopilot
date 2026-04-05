import { getLogger } from "../logging/domains";
import type { RecoveryOrchestrator } from "./orchestrator";

const logger = getLogger("recovery", "event-handler");

function getEventProperties(event: { readonly [key: string]: unknown }): Record<string, unknown> {
	const properties = event.properties;
	return properties !== null && typeof properties === "object"
		? (properties as Record<string, unknown>)
		: {};
}

function extractSessionId(properties: Record<string, unknown>): string | null {
	if (typeof properties.sessionID === "string") {
		return properties.sessionID;
	}

	const info = properties.info;
	if (
		info !== null &&
		typeof info === "object" &&
		typeof (info as Record<string, unknown>).id === "string"
	) {
		return (info as Record<string, unknown>).id as string;
	}

	if (
		info !== null &&
		typeof info === "object" &&
		typeof (info as Record<string, unknown>).sessionID === "string"
	) {
		return (info as Record<string, unknown>).sessionID as string;
	}

	return null;
}

function extractError(properties: Record<string, unknown>): Error | string | null {
	if (properties.error instanceof Error || typeof properties.error === "string") {
		return properties.error;
	}

	const info = properties.info;
	if (info !== null && typeof info === "object") {
		const nestedError = (info as Record<string, unknown>).error;
		if (nestedError instanceof Error || typeof nestedError === "string") {
			return nestedError;
		}
		if (
			nestedError !== null &&
			typeof nestedError === "object" &&
			typeof (nestedError as Record<string, unknown>).message === "string"
		) {
			return new Error((nestedError as Record<string, unknown>).message as string);
		}
	}

	if (properties.error !== null && typeof properties.error === "object") {
		const message = (properties.error as Record<string, unknown>).message;
		if (typeof message === "string") {
			return new Error(message);
		}
	}

	return null;
}

export function createRecoveryEventHandler(orchestrator: RecoveryOrchestrator) {
	return async (input: { event: { type: string; [key: string]: unknown } }): Promise<void> => {
		try {
			const { event } = input;
			const properties = getEventProperties(event);

			switch (event.type) {
				case "session.error": {
					const sessionId = extractSessionId(properties);
					const error = extractError(properties);
					if (!sessionId || !error) {
						return;
					}

					const action = orchestrator.handleError(sessionId, error, properties);
					if (action) {
						logger.info("Recovery action scheduled", {
							sessionId,
							strategy: action.strategy,
							errorCategory: action.errorCategory,
							backoffMs: action.backoffMs,
						});
					}
					return;
				}

				case "session.deleted": {
					const sessionId = extractSessionId(properties);
					if (!sessionId) {
						return;
					}

					orchestrator.reset(sessionId);
					logger.info("Recovery state cleared", { sessionId });
					return;
				}

				default:
					return;
			}
		} catch (error: unknown) {
			logger.warn("Recovery event handling failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};
}
