import { MAX_MEMORY_SUMMARY_LENGTH } from "./constants";
import type { MemoryKind } from "./types";

const HIGH_SIGNAL_TOOL_KEYWORDS = ["config", "install", "create", "setup", "deploy", "migrate"];
const LOW_SIGNAL_TOOL_KEYWORDS = ["read", "grep", "search", "list", "status", "diagnostic"];
const PREFERENCE_PATTERNS = [
	/\bi prefer\b/i,
	/\balways use\b/i,
	/\bnever use\b/i,
	/\bmy preference is\b/i,
	/\bi like to\b/i,
];
const MAX_EXTRACTED_MEMORIES = 3;

export interface ExtractedMemory {
	readonly kind: MemoryKind;
	readonly content: string;
	readonly summary: string;
	readonly confidence: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function readNamedString(
	record: Record<string, unknown>,
	keys: readonly string[],
): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string") {
			const normalized = normalizeWhitespace(value);
			if (normalized.length > 0) {
				return normalized;
			}
		}
	}

	return undefined;
}

function extractTextFragments(value: unknown): readonly string[] {
	if (typeof value === "string") {
		const normalized = normalizeWhitespace(value);
		return normalized.length > 0 ? [normalized] : [];
	}

	if (Array.isArray(value)) {
		return value.flatMap((entry) => extractTextFragments(entry));
	}

	if (!isRecord(value)) {
		return [];
	}

	const directText = readNamedString(value, ["text", "content", "summary", "message", "output"]);
	if (directText) {
		return [directText];
	}

	const nestedResult = value.result;
	if (nestedResult !== undefined) {
		return extractTextFragments(nestedResult);
	}

	return [];
}

function summarizeText(value: unknown, fallback = ""): string {
	const fragments = extractTextFragments(value);
	if (fragments.length > 0) {
		return truncate(fragments.join(" "), MAX_MEMORY_SUMMARY_LENGTH);
	}

	if (!isRecord(value)) {
		return fallback;
	}

	try {
		const serialized = normalizeWhitespace(JSON.stringify(value));
		return serialized.length > 0 ? truncate(serialized, MAX_MEMORY_SUMMARY_LENGTH) : fallback;
	} catch {
		return fallback;
	}
}

function resolveToolName(part: Record<string, unknown>): string | undefined {
	const direct = readNamedString(part, ["toolName", "tool", "name"]);
	if (direct) {
		return direct;
	}

	const nestedTool = part.tool;
	if (isRecord(nestedTool)) {
		return readNamedString(nestedTool, ["name", "toolName"]);
	}

	return undefined;
}

function resolveToolSummary(part: Record<string, unknown>, toolName: string): string {
	const resultValue = part.result ?? part.output ?? part.content ?? part.text;
	return summarizeText(resultValue, `Executed ${toolName}`);
}

function looksLikeToolPart(part: Record<string, unknown>): boolean {
	const type = typeof part.type === "string" ? part.type.toLowerCase() : "";
	return type.includes("tool") || resolveToolName(part) !== undefined;
}

function isHighSignalTool(toolName: string): boolean {
	const normalized = toolName.toLowerCase();
	if (LOW_SIGNAL_TOOL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
		return false;
	}

	return HIGH_SIGNAL_TOOL_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function splitIntoSentences(text: string): readonly string[] {
	const matches = text.match(/[^.!?\n]+(?:[.!?]+|$)/g);
	if (!matches) {
		return [];
	}

	return matches
		.map((sentence) => normalizeWhitespace(sentence))
		.filter((sentence) => sentence.length > 0);
}

function extractPartText(part: unknown): readonly string[] {
	if (!isRecord(part)) {
		return [];
	}

	return extractTextFragments([part.text, part.content, part.message]);
}

function createExtractedMemory(
	kind: MemoryKind,
	content: string,
	confidence: number,
): ExtractedMemory {
	return {
		kind,
		content,
		summary: truncate(content, MAX_MEMORY_SUMMARY_LENGTH),
		confidence,
	};
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

export function truncate(s: string, maxLen: number): string {
	return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function extractToolDecisions(parts: readonly unknown[]): readonly ExtractedMemory[] {
	const memories: ExtractedMemory[] = [];
	const seen = new Set<string>();

	for (const part of parts) {
		if (memories.length >= MAX_EXTRACTED_MEMORIES) {
			break;
		}

		if (!isRecord(part) || !looksLikeToolPart(part)) {
			continue;
		}

		const toolName = resolveToolName(part);
		if (!toolName || !isHighSignalTool(toolName)) {
			continue;
		}

		const summary = resolveToolSummary(part, toolName);
		if (summary.length === 0) {
			continue;
		}

		const content = `Tool decision: ${toolName} — ${summary}`;
		if (seen.has(content)) {
			continue;
		}

		seen.add(content);
		memories.push(createExtractedMemory("decision", content, 0.86));
	}

	return Object.freeze(memories);
}

export function extractExplicitPreferences(parts: readonly unknown[]): readonly ExtractedMemory[] {
	const memories: ExtractedMemory[] = [];
	const seen = new Set<string>();

	for (const part of parts) {
		if (memories.length >= MAX_EXTRACTED_MEMORIES) {
			break;
		}

		for (const text of extractPartText(part)) {
			for (const sentence of splitIntoSentences(text)) {
				if (!PREFERENCE_PATTERNS.some((pattern) => pattern.test(sentence))) {
					continue;
				}

				if (seen.has(sentence)) {
					continue;
				}

				seen.add(sentence);
				memories.push(createExtractedMemory("preference", sentence, 0.92));

				if (memories.length >= MAX_EXTRACTED_MEMORIES) {
					break;
				}
			}

			if (memories.length >= MAX_EXTRACTED_MEMORIES) {
				break;
			}
		}
	}

	return Object.freeze(memories);
}
