import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createForensicEvent } from "../../src/observability/forensic-log";
import {
	listSessionLogs,
	readLatestSessionLog,
	readSessionLog,
	searchEvents,
} from "../../src/observability/log-reader";
import { writeSessionLog } from "../../src/observability/log-writer";

function makeEvent(
	projectRoot: string,
	sessionId: string,
	timestamp: string,
	type: "error" | "decision",
) {
	if (type === "error") {
		return createForensicEvent({
			projectRoot,
			domain: "session",
			timestamp,
			sessionId,
			type: "error",
			code: "rate_limit",
			message: "Rate limited",
			payload: { errorType: "rate_limit", model: "test-model" },
		});
	}

	return createForensicEvent({
		projectRoot,
		domain: "session",
		timestamp,
		sessionId,
		phase: "BUILD",
		agent: "oc-implementer",
		type: "decision",
		payload: { decision: "Test decision", rationale: "Test rationale" },
	});
}

describe("log-reader", () => {
	let projectRoot: string;

	beforeEach(async () => {
		projectRoot = join(tmpdir(), `log-reader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(join(projectRoot, ".opencode-autopilot"), { recursive: true });
	});

	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	test("reads and reconstructs a session log by ID", async () => {
		await writeSessionLog({
			projectRoot,
			sessionId: "sess-1",
			startedAt: "2026-04-01T10:00:00Z",
			events: [
				makeEvent(projectRoot, "sess-1", "2026-04-01T10:00:00Z", "error"),
				makeEvent(projectRoot, "sess-1", "2026-04-01T10:01:00Z", "decision"),
			],
		});

		const result = await readSessionLog("sess-1", projectRoot);
		expect(result).not.toBeNull();
		expect(result?.sessionId).toBe("sess-1");
		expect(result?.events).toHaveLength(2);
		expect(result?.decisions).toHaveLength(1);
	});

	test("returns null for non-existent session", async () => {
		const result = await readSessionLog("missing", projectRoot);
		expect(result).toBeNull();
	});

	test("lists sessions newest first", async () => {
		await writeSessionLog({
			projectRoot,
			sessionId: "old",
			startedAt: "2026-04-01T08:00:00Z",
			events: [makeEvent(projectRoot, "old", "2026-04-01T08:00:00Z", "error")],
		});
		await writeSessionLog({
			projectRoot,
			sessionId: "new",
			startedAt: "2026-04-01T12:00:00Z",
			events: [makeEvent(projectRoot, "new", "2026-04-01T12:00:00Z", "error")],
		});

		const entries = await listSessionLogs(projectRoot);
		expect(entries).toHaveLength(2);
		expect(entries[0].sessionId).toBe("new");
	});

	test("reads latest session log", async () => {
		await writeSessionLog({
			projectRoot,
			sessionId: "latest",
			startedAt: "2026-04-01T12:00:00Z",
			events: [makeEvent(projectRoot, "latest", "2026-04-01T12:00:00Z", "error")],
		});

		const result = await readLatestSessionLog(projectRoot);
		expect(result?.sessionId).toBe("latest");
	});

	test("searchEvents filters forensic events by type and time", () => {
		const events = [
			makeEvent(projectRoot, "sess-1", "2026-04-01T10:00:00Z", "error"),
			makeEvent(projectRoot, "sess-1", "2026-04-01T10:10:00Z", "decision"),
		] as const;

		expect(searchEvents(events, { type: "error" })).toHaveLength(1);
		expect(searchEvents(events, { after: "2026-04-01T10:05:00Z" })).toHaveLength(1);
	});
});
