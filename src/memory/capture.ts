import type { Database } from "bun:sqlite";
import { basename } from "node:path";
import { getLogger } from "../logging/domains";
import { resolveProjectIdentity } from "../projects/resolve";
import * as captureUtils from "./capture-utils";
import { pruneStaleObservations } from "./decay";
import { insertObservation, upsertProject } from "./repository";
import type { ObservationType } from "./types";

const logger = getLogger("memory", "capture");

export interface MemoryCaptureDeps {
	readonly getDb: () => Database;
	readonly projectRoot: string;
}

const CAPTURE_EVENT_TYPES = new Set([
	"session.created",
	"session.deleted",
	"session.error",
	"app.decision",
	"app.phase_transition",
]);

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
					summary: captureUtils.truncate(summary, 200),
					confidence,
					accessCount: 0,
					createdAt: now(),
					lastAccessed: now(),
				},
				deps.getDb(),
			);
		} catch (err) {
			logger.warn("memory capture failed", { error: String(err) });
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
					logger.warn("upsertProject failed", { error: String(err) });
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
							logger.warn("pruneStaleObservations failed", { error: String(err) });
						}
					});
				}
				return;
			}

			case "session.error": {
				const sessionId = captureUtils.extractSessionId(properties);
				if (!sessionId || sessionId !== currentSessionId) return;

				const error = properties.error as Record<string, unknown> | undefined;
				const errorType = typeof error?.type === "string" ? error.type : "unknown";
				const message = typeof error?.message === "string" ? error.message : "Unknown error";
				const content = `${errorType}: ${message}`;
				const summary = captureUtils.truncate(message, 200);

				safeInsert("error", content, summary, 0.7);
				return;
			}

			case "app.decision": {
				const sessionId = captureUtils.extractSessionId(properties);
				if (!sessionId || sessionId !== currentSessionId) return;

				const decision = typeof properties.decision === "string" ? properties.decision : "";
				const rationale = typeof properties.rationale === "string" ? properties.rationale : "";

				if (!decision) return;

				safeInsert("decision", decision, rationale || captureUtils.truncate(decision, 200), 0.8);
				return;
			}

			case "app.phase_transition": {
				const sessionId = captureUtils.extractSessionId(properties);
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

export function createMemoryChatMessageHandler(_deps: MemoryCaptureDeps) {
	return async (
		_input: { readonly sessionID: string },
		_output: { readonly parts: unknown[] },
	): Promise<void> => {
		// V2: Chat-level preference extraction is handled by oc_memory_save tool.
		// The regex-based extraction that lived here produced low-quality results.
		// This handler is kept as a no-op for backward compatibility with the hook registration.
	};
}

export { captureUtils as memoryCaptureInternals };
