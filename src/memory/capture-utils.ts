/**
 * V2: Regex-based preference extraction has been removed.
 * Preferences are now captured via the oc_memory_save tool, which the AI calls explicitly.
 *
 * This module retains only stateless helpers used by the event capture handler.
 *
 * @module
 */

export function extractSessionId(properties: Record<string, unknown>): string | undefined {
	if (typeof properties.sessionID === "string") return properties.sessionID;
	if (properties.info !== null && typeof properties.info === "object") {
		const info = properties.info as Record<string, unknown>;
		if (typeof info.sessionID === "string") return info.sessionID;
		if (typeof info.id === "string") return info.id;
	}
	return undefined;
}

export function truncate(s: string, maxLen: number): string {
	return s.length > maxLen ? s.slice(0, maxLen) : s;
}
