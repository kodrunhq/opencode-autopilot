import { appendFileSync, mkdirSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { appendForensicEventsToKernel, loadForensicEventsFromKernel } from "../kernel/repository";
import { isEnoentError } from "../utils/fs-helpers";
import { getProjectArtifactDir } from "../utils/paths";
import { forensicEventSchema } from "./forensic-schemas";
import type { ForensicEvent, ForensicEventDomain, ForensicEventType } from "./forensic-types";

const FORENSIC_LOG_FILE = "orchestration.jsonl";
const FORENSIC_DEDUP_WINDOW_MS = 1_000;
const FORENSIC_DEDUP_PRUNE_AFTER_MS = 10_000;
const FORENSIC_DEDUP_MAX_ENTRIES = 1_000;
let forensicWriteWarned = false;
let forensicMirrorWarned = false;
const forensicDedupCache = new Map<string, number>();

interface ForensicEventInput {
	readonly timestamp?: string;
	readonly projectRoot: string;
	readonly domain: ForensicEventDomain;
	readonly runId?: string | null;
	readonly sessionId?: string | null;
	readonly parentSessionId?: string | null;
	readonly phase?: string | null;
	readonly dispatchId?: string | null;
	readonly taskId?: number | string | null;
	readonly agent?: string | null;
	readonly type: ForensicEventType;
	readonly code?: string | null;
	readonly message?: string | null;
	readonly payload?: Record<string, string | number | boolean | null | readonly unknown[] | object>;
}

function redactMessage(message: string | null | undefined): string | null {
	if (message == null) {
		return null;
	}
	return message.replace(/[/\\][^\s"']+/g, "[PATH]");
}

function toProjectRootFromArtifactDir(artifactDir: string): string {
	return basename(artifactDir) === ".opencode-autopilot" ? dirname(artifactDir) : artifactDir;
}

function buildDedupKey(
	type: ForensicEventType,
	domain?: ForensicEventDomain | null,
	phase?: string | null,
	agent?: string | null,
	sessionId?: string | null,
): string {
	return `${type}:${domain ?? ""}:${phase ?? ""}:${agent ?? ""}:${sessionId ?? ""}`;
}

function pruneDedupCache(now: number): void {
	if (forensicDedupCache.size <= FORENSIC_DEDUP_MAX_ENTRIES) {
		return;
	}

	// First pass: evict entries older than the prune threshold
	for (const [key, timestamp] of forensicDedupCache) {
		if (now - timestamp > FORENSIC_DEDUP_PRUNE_AFTER_MS) {
			forensicDedupCache.delete(key);
		}
	}

	// Hard cap: if still over limit, evict oldest by insertion order (Map iterates in insertion order)
	if (forensicDedupCache.size > FORENSIC_DEDUP_MAX_ENTRIES) {
		const excess = forensicDedupCache.size - FORENSIC_DEDUP_MAX_ENTRIES;
		let evicted = 0;
		for (const key of forensicDedupCache.keys()) {
			if (evicted >= excess) break;
			forensicDedupCache.delete(key);
			evicted++;
		}
	}
}

export function resetDedupCache(): void {
	forensicDedupCache.clear();
}

export function getDedupCacheSize(): number {
	return forensicDedupCache.size;
}

export function isDuplicateEvent(
	type: ForensicEventType,
	domain?: ForensicEventDomain | null,
	phase?: string | null,
	agent?: string | null,
	sessionId?: string | null,
): boolean {
	const now = Date.now();
	const key = buildDedupKey(type, domain, phase, agent, sessionId);
	const lastSeen = forensicDedupCache.get(key);
	if (lastSeen != null && now - lastSeen < FORENSIC_DEDUP_WINDOW_MS) {
		return true;
	}

	forensicDedupCache.set(key, now);
	pruneDedupCache(now);
	return false;
}

function appendValidatedForensicEvent(artifactDir: string, event: ForensicEvent): void {
	mkdirSync(artifactDir, { recursive: true });

	try {
		appendForensicEventsToKernel(artifactDir, [event]);
	} catch {
		if (!forensicWriteWarned) {
			forensicWriteWarned = true;
		}
	}

	try {
		const logPath = join(artifactDir, FORENSIC_LOG_FILE);
		appendFileSync(logPath, `${JSON.stringify(event)}\n`, "utf-8");
	} catch {
		if (!forensicMirrorWarned) {
			forensicMirrorWarned = true;
		}
	}
}

export function getForensicLogPath(projectRoot: string): string {
	return join(getProjectArtifactDir(projectRoot), FORENSIC_LOG_FILE);
}

export function createForensicEvent(input: ForensicEventInput): ForensicEvent {
	return forensicEventSchema.parse({
		schemaVersion: 1,
		timestamp: input.timestamp ?? new Date().toISOString(),
		projectRoot: input.projectRoot,
		domain: input.domain,
		runId: input.runId ?? null,
		sessionId: input.sessionId ?? null,
		parentSessionId: input.parentSessionId ?? null,
		phase: input.phase ?? null,
		dispatchId: input.dispatchId ?? null,
		taskId: input.taskId ?? null,
		agent: input.agent ?? null,
		type: input.type,
		code: input.code ?? null,
		message: redactMessage(input.message),
		payload: input.payload ?? {},
	});
}

export function appendForensicEvent(projectRoot: string, event: ForensicEventInput): void {
	try {
		if (isDuplicateEvent(event.type, event.domain, event.phase, event.agent, event.sessionId)) {
			return;
		}

		const validated = createForensicEvent(event);
		const artifactDir = getProjectArtifactDir(projectRoot);
		appendValidatedForensicEvent(artifactDir, validated);
	} catch {
		if (!forensicWriteWarned) {
			forensicWriteWarned = true;
		}
	}
}

export function appendForensicEventForArtifactDir(
	artifactDir: string,
	event: Omit<ForensicEventInput, "projectRoot">,
): void {
	try {
		if (isDuplicateEvent(event.type, event.domain, event.phase, event.agent, event.sessionId)) {
			return;
		}

		const validated = createForensicEvent({
			...event,
			projectRoot: toProjectRootFromArtifactDir(artifactDir),
		});
		appendValidatedForensicEvent(artifactDir, validated);
	} catch {
		if (!forensicWriteWarned) {
			forensicWriteWarned = true;
		}
	}
}

export async function readForensicEvents(projectRoot: string): Promise<readonly ForensicEvent[]> {
	const kernelEvents = loadForensicEventsFromKernel(getProjectArtifactDir(projectRoot));
	if (kernelEvents.length > 0) {
		return kernelEvents;
	}

	try {
		const raw = await readFile(getForensicLogPath(projectRoot), "utf-8");
		const events: ForensicEvent[] = [];
		for (const line of raw.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}
			try {
				events.push(forensicEventSchema.parse(JSON.parse(trimmed)));
			} catch {
				// Ignore malformed forensic lines so one bad append does not hide the rest.
			}
		}
		return Object.freeze(events);
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return Object.freeze([]);
		}
		throw error;
	}
}

export async function listProjectsWithForensicLogs(logsRoot?: string): Promise<readonly string[]> {
	const root = logsRoot;
	if (!root) {
		return Object.freeze([]);
	}

	try {
		const entries = await readdir(root, { withFileTypes: true });
		const projects = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => join(root, entry.name));
		return Object.freeze(projects);
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return Object.freeze([]);
		}
		throw error;
	}
}
