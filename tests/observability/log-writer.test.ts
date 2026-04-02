import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeSessionLog } from "../../src/observability/log-writer";
import type { SessionEvent } from "../../src/observability/types";

function makeEvents(sessionId: string): readonly SessionEvent[] {
	return [
		{
			timestamp: "2026-04-01T10:00:00.000Z",
			sessionId,
			type: "error",
			errorType: "rate_limit",
			model: "anthropic/claude-3-opus",
			message: "Rate limited",
		},
		{
			timestamp: "2026-04-01T10:00:05.000Z",
			sessionId,
			type: "fallback",
			failedModel: "anthropic/claude-3-opus",
			nextModel: "anthropic/claude-3-sonnet",
			reason: "rate_limit",
			success: true,
		},
		{
			timestamp: "2026-04-01T10:01:00.000Z",
			sessionId,
			type: "decision",
			phase: "BUILD",
			agent: "oc-implementer",
			decision: "Use spread pattern for immutability",
			rationale: "Follows project CLAUDE.md constraints",
		},
		{
			timestamp: "2026-04-01T10:02:00.000Z",
			sessionId,
			type: "model_switch",
			fromModel: "anthropic/claude-3-opus",
			toModel: "anthropic/claude-3-sonnet",
			trigger: "fallback",
		},
	] as const;
}

describe("writeSessionLog", () => {
	let logsDir: string;

	beforeEach(async () => {
		logsDir = join(tmpdir(), `log-writer-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(logsDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(logsDir, { recursive: true, force: true });
	});

	test("creates a JSON file at {logsDir}/{sessionID}.json", async () => {
		const sessionId = "test-session-001";
		const events = makeEvents(sessionId);
		const startedAt = "2026-04-01T10:00:00.000Z";

		await writeSessionLog({ sessionId, startedAt, events }, logsDir);

		const files = await readdir(logsDir);
		expect(files).toContain(`${sessionId}.json`);
	});

	test("uses atomic write pattern (temp file not visible after write)", async () => {
		const sessionId = "test-session-atomic";
		const events = makeEvents(sessionId);

		await writeSessionLog({ sessionId, startedAt: "2026-04-01T10:00:00.000Z", events }, logsDir);

		// After write completes, only the final JSON file should exist (no .tmp files)
		const files = await readdir(logsDir);
		const tmpFiles = files.filter((f) => f.includes(".tmp."));
		expect(tmpFiles).toHaveLength(0);
		expect(files).toContain(`${sessionId}.json`);
	});

	test("creates logs directory if it does not exist", async () => {
		const nestedDir = join(logsDir, "nested", "deep");
		const sessionId = "test-session-mkdir";

		await writeSessionLog(
			{ sessionId, startedAt: "2026-04-01T10:00:00.000Z", events: makeEvents(sessionId) },
			nestedDir,
		);

		const files = await readdir(nestedDir);
		expect(files).toContain(`${sessionId}.json`);
	});

	test("persisted JSON contains valid session log structure", async () => {
		const sessionId = "test-session-structure";
		const events = makeEvents(sessionId);
		const startedAt = "2026-04-01T10:00:00.000Z";

		await writeSessionLog({ sessionId, startedAt, events }, logsDir);

		const content = await readFile(join(logsDir, `${sessionId}.json`), "utf-8");
		const parsed = JSON.parse(content);

		expect(parsed.schemaVersion).toBe(1);
		expect(parsed.sessionId).toBe(sessionId);
		expect(parsed.startedAt).toBe(startedAt);
		expect(parsed.endedAt).toBeTypeOf("string");
		expect(parsed.events).toHaveLength(4);
	});

	test("extracts decisions from events into decisions array", async () => {
		const sessionId = "test-session-decisions";
		const events = makeEvents(sessionId);

		await writeSessionLog({ sessionId, startedAt: "2026-04-01T10:00:00.000Z", events }, logsDir);

		const content = await readFile(join(logsDir, `${sessionId}.json`), "utf-8");
		const parsed = JSON.parse(content);

		expect(parsed.decisions).toHaveLength(1);
		expect(parsed.decisions[0].phase).toBe("BUILD");
		expect(parsed.decisions[0].agent).toBe("oc-implementer");
		expect(parsed.decisions[0].decision).toBe("Use spread pattern for immutability");
	});

	test("counts errors by type in errorSummary", async () => {
		const sessionId = "test-session-errors";
		const events = makeEvents(sessionId);

		await writeSessionLog({ sessionId, startedAt: "2026-04-01T10:00:00.000Z", events }, logsDir);

		const content = await readFile(join(logsDir, `${sessionId}.json`), "utf-8");
		const parsed = JSON.parse(content);

		expect(parsed.errorSummary).toBeDefined();
		expect(parsed.errorSummary.rate_limit).toBe(1);
	});

	test("handles empty events gracefully", async () => {
		const sessionId = "test-session-empty";

		await writeSessionLog(
			{ sessionId, startedAt: "2026-04-01T10:00:00.000Z", events: [] },
			logsDir,
		);

		const content = await readFile(join(logsDir, `${sessionId}.json`), "utf-8");
		const parsed = JSON.parse(content);

		expect(parsed.events).toHaveLength(0);
		expect(parsed.decisions).toHaveLength(0);
		expect(parsed.errorSummary).toEqual({});
	});
});
