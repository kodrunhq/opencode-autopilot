/**
 * Memory capture handlers.
 *
 * Event capture remains a supporting path for project incidents and decisions.
 * Explicit user preference capture happens on the chat.message hook where the
 * actual outbound user-authored text parts are available.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { basename } from "node:path";
import { resolveProjectIdentity } from "../projects/resolve";
import { pruneStaleObservations } from "./decay";
import { insertObservation, upsertPreferenceRecord, upsertProject } from "./repository";
import type { ObservationType } from "./types";

/**
 * Dependencies for the memory capture handlers.
 */
export interface MemoryCaptureDeps {
	readonly getDb: () => Database;
	readonly projectRoot: string;
}

interface PreferenceCandidate {
	readonly key: string;
	readonly value: string;
	readonly scope: "global" | "project";
	readonly confidence: number;
	readonly statement: string;
}

/**
 * Events that produce supporting observations.
 */
const CAPTURE_EVENT_TYPES = new Set([
	"session.created",
	"session.deleted",
	"session.error",
	"app.decision",
	"app.phase_transition",
]);

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

/**
 * Extracts a session ID from event properties.
 * Supports properties.sessionID, properties.info.id, properties.info.sessionID.
 */
function extractSessionId(properties: Record<string, unknown>): string | undefined {
	if (typeof properties.sessionID === "string") return properties.sessionID;
	if (properties.info !== null && typeof properties.info === "object") {
		const info = properties.info as Record<string, unknown>;
		if (typeof info.sessionID === "string") return info.sessionID;
		if (typeof info.id === "string") return info.id;
	}
	return undefined;
}

function normalizePreferenceKey(value: string): string {
	const normalized = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.slice(0, 6)
		.join(".");
	return normalized.length > 0 ? normalized : "user.preference";
}

function normalizePreferenceValue(value: string): string {
	return value
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[.!?]+$/, "");
}

function inferPreferenceScope(text: string): "global" | "project" {
	const lowerText = text.toLowerCase();
	return PROJECT_SCOPE_HINTS.some((hint) => lowerText.includes(hint)) ? "project" : "global";
}

function extractTextPartContent(part: unknown): string | null {
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

function extractExplicitPreferenceCandidates(
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

/**
 * Safely truncate a string to maxLen characters.
 */
function truncate(s: string, maxLen: number): string {
	return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Creates an event capture handler matching the plugin event hook signature.
 */
export function createMemoryCaptureHandler(deps: MemoryCaptureDeps) {
	let currentSessionId: string | null = null;
	let currentProjectKey: string | null = null;

	const now = () => new Date().toISOString();

	function safeInsert(
		type: ObservationType,
		content: string,
		summary: string,
		confidence: number,
	): void {
		if (!currentSessionId || !currentProjectKey) return;
		try {
			insertObservation(
				{
					projectId: currentProjectKey,
					sessionId: currentSessionId,
					type,
					content,
					summary: truncate(summary, 200),
					confidence,
					accessCount: 0,
					createdAt: now(),
					lastAccessed: now(),
				},
				deps.getDb(),
			);
		} catch (err) {
			console.warn("[opencode-autopilot] memory capture failed:", err);
		}
	}

	return async (input: {
		readonly event: { readonly type: string; readonly [key: string]: unknown };
	}): Promise<void> => {
		const { event } = input;
		const rawProps = event.properties ?? {};
		const properties: Record<string, unknown> =
			rawProps !== null && typeof rawProps === "object" && !Array.isArray(rawProps)
				? (rawProps as Record<string, unknown>)
				: {};

		if (!CAPTURE_EVENT_TYPES.has(event.type)) return;

		switch (event.type) {
			case "session.created": {
				const rawInfo = properties.info;
				if (rawInfo === null || typeof rawInfo !== "object") return;
				const info = rawInfo as { id?: string };
				if (!info.id) return;

				currentSessionId = info.id;
				const resolvedProject = await resolveProjectIdentity(deps.projectRoot, {
					db: deps.getDb(),
				});
				currentProjectKey = resolvedProject.id;
				const projectName = basename(deps.projectRoot);

				try {
					upsertProject(
						{
							id: currentProjectKey,
							path: deps.projectRoot,
							name: projectName,
							firstSeenAt: resolvedProject.firstSeenAt,
							lastUpdated: now(),
						},
						deps.getDb(),
					);
				} catch (err) {
					console.warn("[opencode-autopilot] upsertProject failed:", err);
				}
				return;
			}

			case "session.deleted": {
				const projectKey = currentProjectKey;
				const db = deps.getDb();

				currentSessionId = null;
				currentProjectKey = null;

				if (projectKey) {
					queueMicrotask(() => {
						try {
							pruneStaleObservations(projectKey, db);
						} catch (err) {
							console.warn("[opencode-autopilot] pruneStaleObservations failed:", err);
						}
					});
				}
				return;
			}

			case "session.error": {
				const sessionId = extractSessionId(properties);
				if (!sessionId || sessionId !== currentSessionId) return;

				const error = properties.error as Record<string, unknown> | undefined;
				const errorType = typeof error?.type === "string" ? error.type : "unknown";
				const message = typeof error?.message === "string" ? error.message : "Unknown error";
				const content = `${errorType}: ${message}`;
				const summary = truncate(message, 200);

				safeInsert("error", content, summary, 0.7);
				return;
			}

			case "app.decision": {
				const sessionId = extractSessionId(properties);
				if (!sessionId || sessionId !== currentSessionId) return;

				const decision = typeof properties.decision === "string" ? properties.decision : "";
				const rationale = typeof properties.rationale === "string" ? properties.rationale : "";

				if (!decision) return;

				safeInsert("decision", decision, rationale || truncate(decision, 200), 0.8);
				return;
			}

			case "app.phase_transition": {
				const sessionId = extractSessionId(properties);
				if (!sessionId || sessionId !== currentSessionId) return;

				const fromPhase =
					typeof properties.fromPhase === "string" ? properties.fromPhase : "unknown";
				const toPhase = typeof properties.toPhase === "string" ? properties.toPhase : "unknown";
				const content = `Phase transition: ${fromPhase} -> ${toPhase}`;

				safeInsert("pattern", content, content, 0.6);
				return;
			}

			default:
				return;
		}
	};
}

/**
 * Creates a chat.message capture handler that records explicit user preferences.
 */
export function createMemoryChatMessageHandler(deps: MemoryCaptureDeps) {
	return async (
		input: { readonly sessionID: string },
		output: { readonly parts: unknown[] },
	): Promise<void> => {
		try {
			const candidates = extractExplicitPreferenceCandidates(output.parts);
			if (candidates.length === 0) {
				return;
			}

			const resolvedProject = await resolveProjectIdentity(deps.projectRoot, {
				db: deps.getDb(),
			});
			const projectName = basename(deps.projectRoot);
			const timestamp = new Date().toISOString();

			upsertProject(
				{
					id: resolvedProject.id,
					path: deps.projectRoot,
					name: projectName,
					firstSeenAt: resolvedProject.firstSeenAt,
					lastUpdated: timestamp,
				},
				deps.getDb(),
			);

			for (const candidate of candidates) {
				upsertPreferenceRecord(
					{
						key: candidate.key,
						value: candidate.value,
						scope: candidate.scope,
						projectId: candidate.scope === "project" ? resolvedProject.id : null,
						status: "confirmed",
						confidence: candidate.confidence,
						sourceSession: input.sessionID,
						createdAt: timestamp,
						lastUpdated: timestamp,
						evidence: [
							{
								sessionId: input.sessionID,
								statement: candidate.statement,
								confidence: candidate.confidence,
								confirmed: true,
								createdAt: timestamp,
							},
						],
					},
					deps.getDb(),
				);
			}
		} catch (err) {
			console.warn("[opencode-autopilot] explicit preference capture failed:", err);
		}
	};
}

export const memoryCaptureInternals = Object.freeze({
	extractExplicitPreferenceCandidates,
	extractTextPartContent,
	inferPreferenceScope,
	normalizePreferenceKey,
	normalizePreferenceValue,
});
