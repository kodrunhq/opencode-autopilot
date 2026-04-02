import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	listSessionLogs,
	readLatestSessionLog,
	readSessionLog,
	searchEvents,
} from "../../src/observability/log-reader";
import type { SessionEvent } from "../../src/observability/types";

function makeSessionLogJson(
	sessionId: string,
	startedAt: string,
	endedAt: string,
	events: readonly SessionEvent[] = [],
): string {
	const decisions = events
		.filter((e): e is SessionEvent & { type: "decision" } => e.type === "decision")
		.map((e) => ({
			timestamp: e.timestamp,
			phase: e.phase,
			agent: e.agent,
			decision: e.decision,
			rationale: e.rationale,
		}));

	const errorSummary: Record<string, number> = {};
	for (const e of events) {
		if (e.type === "error") {
			errorSummary[e.errorType] = (errorSummary[e.errorType] ?? 0) + 1;
		}
	}

	return JSON.stringify({
		schemaVersion: 1,
		sessionId,
		startedAt,
		endedAt,
		events,
		decisions,
		errorSummary,
	});
}

describe("readSessionLog", () => {
	let logsDir: string;

	beforeEach(async () => {
		logsDir = join(tmpdir(), `log-reader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(logsDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(logsDir, { recursive: true, force: true });
	});

	test("reads and parses a specific session log by ID", async () => {
		const sessionId = "read-session-001";
		const content = makeSessionLogJson(sessionId, "2026-04-01T10:00:00Z", "2026-04-01T10:30:00Z");
		await writeFile(join(logsDir, `${sessionId}.json`), content, "utf-8");

		const result = await readSessionLog(sessionId, logsDir);

		expect(result).not.toBeNull();
		expect(result?.sessionId).toBe(sessionId);
		expect(result?.schemaVersion).toBe(1);
		expect(result?.startedAt).toBe("2026-04-01T10:00:00Z");
	});

	test("returns null for non-existent session", async () => {
		const result = await readSessionLog("nonexistent-session", logsDir);
		expect(result).toBeNull();
	});

	test("returns null for malformed JSON", async () => {
		await writeFile(join(logsDir, "bad-session.json"), "not-valid-json{{{", "utf-8");
		const result = await readSessionLog("bad-session", logsDir);
		expect(result).toBeNull();
	});

	test("returns null for invalid schema (missing required fields)", async () => {
		await writeFile(join(logsDir, "invalid-session.json"), '{"foo":"bar"}', "utf-8");
		const result = await readSessionLog("invalid-session", logsDir);
		expect(result).toBeNull();
	});
});

describe("listSessionLogs", () => {
	let logsDir: string;

	beforeEach(async () => {
		logsDir = join(tmpdir(), `log-list-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(logsDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(logsDir, { recursive: true, force: true });
	});

	test("returns all session logs sorted by startedAt descending", async () => {
		// Write 3 sessions with different startedAt times
		await writeFile(
			join(logsDir, "session-a.json"),
			makeSessionLogJson("session-a", "2026-04-01T08:00:00Z", "2026-04-01T08:30:00Z"),
			"utf-8",
		);
		await writeFile(
			join(logsDir, "session-b.json"),
			makeSessionLogJson("session-b", "2026-04-01T12:00:00Z", "2026-04-01T12:30:00Z"),
			"utf-8",
		);
		await writeFile(
			join(logsDir, "session-c.json"),
			makeSessionLogJson("session-c", "2026-04-01T10:00:00Z", "2026-04-01T10:30:00Z"),
			"utf-8",
		);

		const entries = await listSessionLogs(logsDir);

		expect(entries).toHaveLength(3);
		// Newest first
		expect(entries[0].sessionId).toBe("session-b");
		expect(entries[1].sessionId).toBe("session-c");
		expect(entries[2].sessionId).toBe("session-a");
	});

	test("returns empty array for missing logs directory", async () => {
		const missingDir = join(logsDir, "nonexistent");
		const entries = await listSessionLogs(missingDir);
		expect(entries).toHaveLength(0);
	});

	test("returns empty array for empty logs directory", async () => {
		const entries = await listSessionLogs(logsDir);
		expect(entries).toHaveLength(0);
	});

	test("skips non-JSON files", async () => {
		await writeFile(join(logsDir, "readme.txt"), "not a log", "utf-8");
		await writeFile(
			join(logsDir, "session-a.json"),
			makeSessionLogJson("session-a", "2026-04-01T10:00:00Z", "2026-04-01T10:30:00Z"),
			"utf-8",
		);

		const entries = await listSessionLogs(logsDir);
		expect(entries).toHaveLength(1);
		expect(entries[0].sessionId).toBe("session-a");
	});

	test("SessionLogEntry includes eventCount", async () => {
		const events: readonly SessionEvent[] = [
			{
				timestamp: "2026-04-01T10:00:00Z",
				sessionId: "session-with-events",
				type: "error",
				errorType: "rate_limit",
				model: "test-model",
				message: "Rate limited",
			},
			{
				timestamp: "2026-04-01T10:01:00Z",
				sessionId: "session-with-events",
				type: "fallback",
				failedModel: "model-a",
				nextModel: "model-b",
				reason: "rate_limit",
				success: true,
			},
		];

		await writeFile(
			join(logsDir, "session-with-events.json"),
			makeSessionLogJson(
				"session-with-events",
				"2026-04-01T10:00:00Z",
				"2026-04-01T10:30:00Z",
				events,
			),
			"utf-8",
		);

		const entries = await listSessionLogs(logsDir);
		expect(entries).toHaveLength(1);
		expect(entries[0].eventCount).toBe(2);
	});
});

describe("readLatestSessionLog", () => {
	let logsDir: string;

	beforeEach(async () => {
		logsDir = join(tmpdir(), `log-latest-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(logsDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(logsDir, { recursive: true, force: true });
	});

	test("returns the most recent session log", async () => {
		await writeFile(
			join(logsDir, "session-old.json"),
			makeSessionLogJson("session-old", "2026-04-01T08:00:00Z", "2026-04-01T08:30:00Z"),
			"utf-8",
		);
		await writeFile(
			join(logsDir, "session-new.json"),
			makeSessionLogJson("session-new", "2026-04-01T12:00:00Z", "2026-04-01T12:30:00Z"),
			"utf-8",
		);

		const result = await readLatestSessionLog(logsDir);
		expect(result).not.toBeNull();
		expect(result?.sessionId).toBe("session-new");
	});

	test("returns null when no logs exist", async () => {
		const result = await readLatestSessionLog(logsDir);
		expect(result).toBeNull();
	});
});

describe("searchEvents", () => {
	const events: readonly SessionEvent[] = [
		{
			timestamp: "2026-04-01T10:00:00Z",
			sessionId: "s1",
			type: "error",
			errorType: "rate_limit",
			model: "model-a",
			message: "Rate limited",
		},
		{
			timestamp: "2026-04-01T10:05:00Z",
			sessionId: "s1",
			type: "fallback",
			failedModel: "model-a",
			nextModel: "model-b",
			reason: "rate_limit",
			success: true,
		},
		{
			timestamp: "2026-04-01T10:10:00Z",
			sessionId: "s1",
			type: "decision",
			phase: "BUILD",
			agent: "oc-implementer",
			decision: "Test decision",
			rationale: "Test rationale",
		},
		{
			timestamp: "2026-04-01T10:15:00Z",
			sessionId: "s1",
			type: "error",
			errorType: "quota_exceeded",
			model: "model-b",
			message: "Quota exceeded",
		},
	];

	test("filters events by type", () => {
		const errors = searchEvents(events, { type: "error" });
		expect(errors).toHaveLength(2);
		for (const e of errors) {
			expect(e.type).toBe("error");
		}
	});

	test("filters events by time range (after)", () => {
		const result = searchEvents(events, { after: "2026-04-01T10:06:00Z" });
		expect(result).toHaveLength(2);
	});

	test("filters events by time range (before)", () => {
		const result = searchEvents(events, { before: "2026-04-01T10:06:00Z" });
		expect(result).toHaveLength(2);
	});

	test("combines type and time range filters", () => {
		const result = searchEvents(events, {
			type: "error",
			after: "2026-04-01T10:06:00Z",
		});
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("error");
	});

	test("returns all events when no filters provided", () => {
		const result = searchEvents(events, {});
		expect(result).toHaveLength(4);
	});

	test("returns empty array when no events match", () => {
		const result = searchEvents(events, { type: "model_switch" });
		expect(result).toHaveLength(0);
	});
});
