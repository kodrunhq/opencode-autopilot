import { getLogger } from "../logging/domains";
import type { createContextInjector } from "./injector";

const logger = getLogger("context", "compaction-handler");

interface EventProperties {
	readonly sessionID?: string;
	readonly info?: {
		readonly sessionID?: string;
		readonly id?: string;
	};
}

function extractSessionID(properties: unknown): string | undefined {
	if (!properties || typeof properties !== "object") {
		return undefined;
	}

	const eventProperties = properties as EventProperties;
	if (typeof eventProperties.sessionID === "string") {
		return eventProperties.sessionID;
	}

	if (typeof eventProperties.info?.sessionID === "string") {
		return eventProperties.info.sessionID;
	}

	if (typeof eventProperties.info?.id === "string") {
		return eventProperties.info.id;
	}

	return undefined;
}

export function createCompactionHandler(injector: ReturnType<typeof createContextInjector>) {
	return async (input: {
		readonly event: {
			readonly type: string;
			readonly properties?: unknown;
		};
	}): Promise<void> => {
		try {
			if (input.event.type !== "session.compacted") {
				return;
			}

			const sessionID = extractSessionID(input.event.properties);
			if (!sessionID) {
				return;
			}

			injector.clearCache(sessionID);
			await injector({ sessionID }, { system: [] });
		} catch (error) {
			logger.warn("context compaction handling failed", { error: String(error) });
		}
	};
}
