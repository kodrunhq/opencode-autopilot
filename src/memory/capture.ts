/**
 * Event capture handler for memory observations.
 *
 * Subscribes to OpenCode session events and extracts memory-worthy
 * observations from decision, error, and phase_transition events.
 * Noisy events (tool_complete, context_warning, session_start/end)
 * are filtered out per Research Pitfall 4.
 *
 * Factory pattern matches createObservabilityEventHandler in
 * src/observability/event-handlers.ts.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { basename } from "node:path";
import { pruneStaleObservations } from "./decay";
import { computeProjectKey } from "./project-key";
import { insertObservation, upsertProject } from "./repository";
import type { ObservationType } from "./types";

/**
 * Dependencies for the memory capture handler.
 */
export interface MemoryCaptureDeps {
	readonly getDb: () => Database;
	readonly projectRoot: string;
}

/**
 * Events that produce memory observations.
 */
const CAPTURE_EVENT_TYPES = new Set([
	"session.created",
	"session.deleted",
	"session.error",
	"app.decision",
	"app.phase_transition",
]);

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

/**
 * Safely truncate a string to maxLen characters.
 */
function truncate(s: string, maxLen: number): string {
	return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Creates a memory capture handler that subscribes to OpenCode events.
 *
 * Returns an async function matching the event handler signature:
 * `(input: { event: { type: string; [key: string]: unknown } }) => Promise<void>`
 *
 * Pure observer: never modifies the event or session output.
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
		const properties = (event.properties ?? {}) as Record<string, unknown>;

		// Skip noisy events early
		if (!CAPTURE_EVENT_TYPES.has(event.type)) return;

		switch (event.type) {
			case "session.created": {
				const rawInfo = properties.info;
				if (rawInfo === null || typeof rawInfo !== "object") return;
				const info = rawInfo as { id?: string };
				if (!info.id) return;

				currentSessionId = info.id;
				currentProjectKey = computeProjectKey(deps.projectRoot);
				const projectName = basename(deps.projectRoot);

				try {
					upsertProject(
						{
							id: currentProjectKey,
							path: deps.projectRoot,
							name: projectName,
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

				// Reset state
				currentSessionId = null;
				currentProjectKey = null;

				// Defer pruning to avoid blocking the event loop
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
				const summary = content;

				safeInsert("pattern", content, summary, 0.6);
				return;
			}

			default:
				return;
		}
	};
}
