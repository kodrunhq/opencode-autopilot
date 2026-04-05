const PROJECT_SCOPE_HINTS = [
	"in this repo",
	"for this repo",
	"in this project",
	"for this project",
	"in this codebase",
	"for this codebase",
	"here ",
	"this repo ",
	"this project ",
] as const;

const EXPLICIT_PREFERENCE_PATTERNS = [
	{
		regex: /\b(?:please|do|always|generally)\s+(?:use|prefer|keep|run|avoid)\s+(.+?)(?:[.!?]|$)/i,
		buildValue: (match: RegExpMatchArray) => match[1]?.trim() ?? "",
	},
	{
		regex: /\b(?:i|we)\s+(?:prefer|want|need|like)\s+(.+?)(?:[.!?]|$)/i,
		buildValue: (match: RegExpMatchArray) => match[1]?.trim() ?? "",
	},
	{
		regex: /\b(?:don't|do not|never)\s+(.+?)(?:[.!?]|$)/i,
		buildValue: (match: RegExpMatchArray) => `avoid ${match[1]?.trim() ?? ""}`,
	},
] as const;

export interface PreferenceCandidate {
	readonly key: string;
	readonly value: string;
	readonly scope: "global" | "project";
	readonly confidence: number;
	readonly statement: string;
}

export function extractSessionId(properties: Record<string, unknown>): string | undefined {
	if (typeof properties.sessionID === "string") return properties.sessionID;
	if (properties.info !== null && typeof properties.info === "object") {
		const info = properties.info as Record<string, unknown>;
		if (typeof info.sessionID === "string") return info.sessionID;
		if (typeof info.id === "string") return info.id;
	}
	return undefined;
}

export function normalizePreferenceKey(value: string): string {
	const normalized = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.slice(0, 6)
		.join(".");
	return normalized.length > 0 ? normalized : "user.preference";
}

export function normalizePreferenceValue(value: string): string {
	return value
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[.!?]+$/, "");
}

export function inferPreferenceScope(text: string): "global" | "project" {
	const lowerText = text.toLowerCase();
	return PROJECT_SCOPE_HINTS.some((hint) => lowerText.includes(hint)) ? "project" : "global";
}

export function extractTextPartContent(part: unknown): string | null {
	if (part === null || typeof part !== "object") {
		return null;
	}

	const record = part as Record<string, unknown>;
	if (record.type !== "text") {
		return null;
	}

	if (typeof record.text === "string" && record.text.trim().length > 0) {
		return record.text;
	}
	if (typeof record.content === "string" && record.content.trim().length > 0) {
		return record.content;
	}

	return null;
}

export function extractExplicitPreferenceCandidates(
	parts: readonly unknown[],
): readonly PreferenceCandidate[] {
	const joinedText = parts
		.map(extractTextPartContent)
		.filter((value): value is string => value !== null)
		.join("\n")
		.trim();
	if (joinedText.length === 0) {
		return Object.freeze([]);
	}

	const candidates: PreferenceCandidate[] = [];
	const scope = inferPreferenceScope(joinedText);
	const lines = joinedText
		.split(/\n+/)
		.flatMap((line) => line.split(/(?<=[.!?])\s+/))
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && line.length <= 500);

	for (const line of lines) {
		for (const pattern of EXPLICIT_PREFERENCE_PATTERNS) {
			const match = line.match(pattern.regex);
			if (!match) {
				continue;
			}

			const value = normalizePreferenceValue(pattern.buildValue(match));
			if (value.length < 6) {
				continue;
			}

			candidates.push(
				Object.freeze({
					key: normalizePreferenceKey(value),
					value,
					scope,
					confidence: 0.9,
					statement: line,
				}),
			);
			break;
		}
	}

	const seen = new Set<string>();
	return Object.freeze(
		candidates.filter((candidate) => {
			const uniqueness = `${candidate.scope}:${candidate.key}:${candidate.value}`;
			if (seen.has(uniqueness)) {
				return false;
			}
			seen.add(uniqueness);
			return true;
		}),
	);
}

export function truncate(s: string, maxLen: number): string {
	return s.length > maxLen ? s.slice(0, maxLen) : s;
}
