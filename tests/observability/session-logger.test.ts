import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSessionLog, logEvent } from "../../src/observability/session-logger";
import type { SessionEvent } from "../../src/observability/types";

describe("SessionLogger", () => {
	let logsDir: string;

	beforeEach(async () => {
		logsDir = join(tmpdir(), `session-logs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(logsDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(logsDir, { recursive: true, force: true });
	});

	test("creates a log file when logEvent is called with a fallback event", async () => {
		const event: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-001",
			type: "fallback",
			failedModel: "anthropic/claude-3-opus",
			nextModel: "anthropic/claude-3-sonnet",
			reason: "rate_limit",
			success: true,
		};

		await logEvent(event, logsDir);

		const logPath = join(logsDir, "session-001.jsonl");
		const content = await readFile(logPath, "utf-8");
		expect(content.trim()).not.toBe("");

		const parsed = JSON.parse(content.trim());
		expect(parsed.type).toBe("fallback");
		expect(parsed.failedModel).toBe("anthropic/claude-3-opus");
	});

	test("appends multiple events to the same session log file as JSON lines", async () => {
		const event1: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-002",
			type: "error",
			errorType: "rate_limit",
			model: "anthropic/claude-3-opus",
			message: "Rate limited",
		};

		const event2: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-002",
			type: "fallback",
			failedModel: "anthropic/claude-3-opus",
			nextModel: "anthropic/claude-3-sonnet",
			reason: "rate_limit",
			success: true,
		};

		await logEvent(event1, logsDir);
		await logEvent(event2, logsDir);

		const logPath = join(logsDir, "session-002.jsonl");
		const content = await readFile(logPath, "utf-8");
		const lines = content.trim().split("\n");
		expect(lines.length).toBe(2);

		const parsed1 = JSON.parse(lines[0]);
		const parsed2 = JSON.parse(lines[1]);
		expect(parsed1.type).toBe("error");
		expect(parsed2.type).toBe("fallback");
	});

	test("validates events against Zod schema and rejects invalid events", async () => {
		const invalidEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-003",
			type: "unknown_type",
		} as unknown as SessionEvent;

		await expect(logEvent(invalidEvent, logsDir)).rejects.toThrow();
	});

	test("getSessionLog reads and parses all events for a given session ID", async () => {
		const event1: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-004",
			type: "decision",
			phase: "BUILD",
			agent: "oc-implementer",
			decision: "Use TDD approach",
			rationale: "Better test coverage",
		};

		const event2: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-004",
			type: "model_switch",
			fromModel: "anthropic/claude-3-opus",
			toModel: "anthropic/claude-3-sonnet",
			trigger: "fallback",
		};

		await logEvent(event1, logsDir);
		await logEvent(event2, logsDir);

		const events = await getSessionLog("session-004", logsDir);
		expect(events.length).toBe(2);
		expect(events[0].type).toBe("decision");
		expect(events[1].type).toBe("model_switch");
	});

	test("logEvent handles all four event types: fallback, error, decision, model_switch", async () => {
		const fallbackEvent: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-005",
			type: "fallback",
			failedModel: "a/m1",
			nextModel: "a/m2",
			reason: "timeout",
			success: true,
		};

		const errorEvent: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-005",
			type: "error",
			errorType: "quota_exceeded",
			model: "a/m1",
			message: "Quota exceeded",
		};

		const decisionEvent: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-005",
			type: "decision",
			phase: "RECON",
			agent: "oc-researcher",
			decision: "Search GitHub",
			rationale: "Find existing solutions",
		};

		const switchEvent: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-005",
			type: "model_switch",
			fromModel: "a/m1",
			toModel: "a/m2",
			trigger: "user",
		};

		await logEvent(fallbackEvent, logsDir);
		await logEvent(errorEvent, logsDir);
		await logEvent(decisionEvent, logsDir);
		await logEvent(switchEvent, logsDir);

		const events = await getSessionLog("session-005", logsDir);
		expect(events.length).toBe(4);

		const types = events.map((e) => e.type);
		expect(types).toContain("fallback");
		expect(types).toContain("error");
		expect(types).toContain("decision");
		expect(types).toContain("model_switch");
	});

	test("each event includes timestamp, sessionId, and type fields", async () => {
		const event: SessionEvent = {
			timestamp: "2026-04-02T12:00:00.000Z",
			sessionId: "session-006",
			type: "error",
			errorType: "service_unavailable",
			model: "a/m1",
			message: "Service unavailable",
		};

		await logEvent(event, logsDir);

		const events = await getSessionLog("session-006", logsDir);
		expect(events.length).toBe(1);
		expect(events[0].timestamp).toBe("2026-04-02T12:00:00.000Z");
		expect(events[0].sessionId).toBe("session-006");
		expect(events[0].type).toBe("error");
	});

	test("creates logs directory if it does not exist", async () => {
		const nestedDir = join(logsDir, "nested", "deep", "logs");

		const event: SessionEvent = {
			timestamp: new Date().toISOString(),
			sessionId: "session-007",
			type: "fallback",
			failedModel: "a/m1",
			nextModel: "a/m2",
			reason: "rate_limit",
			success: false,
		};

		await logEvent(event, nestedDir);

		const events = await getSessionLog("session-007", nestedDir);
		expect(events.length).toBe(1);
		expect(events[0].type).toBe("fallback");
	});
});
