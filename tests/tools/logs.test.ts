import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { logsCore } from "../../src/tools/logs";

describe("oc_logs tool", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `logs-test-${randomBytes(8).toString("hex")}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	function createSessionLog(
		sessionId: string,
		overrides?: Partial<{
			startedAt: string;
			endedAt: string | null;
			events: unknown[];
			decisions: unknown[];
		}>,
	) {
		return {
			schemaVersion: 1,
			sessionId,
			startedAt: overrides?.startedAt ?? "2026-04-01T10:00:00Z",
			endedAt: overrides?.endedAt ?? "2026-04-01T10:30:00Z",
			events: overrides?.events ?? [
				{
					type: "error",
					timestamp: "2026-04-01T10:05:00Z",
					sessionId,
					errorType: "rate_limit",
					model: "claude-sonnet-4-20250514",
					message: "Rate limited",
				},
			],
			decisions: overrides?.decisions ?? [
				{
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "Use TDD approach",
					rationale: "Test coverage requirement",
				},
			],
			errorSummary: { rate_limit: 1 },
		};
	}

	test("logsCore list returns session list with displayText", async () => {
		const log = createSessionLog("session-abc");
		await writeFile(join(testDir, "session-abc.json"), JSON.stringify(log));

		const result = JSON.parse(await logsCore("list", undefined, testDir));
		expect(result.action).toBe("logs_list");
		expect(result.sessions).toBeArrayOfSize(1);
		expect(result.sessions[0].sessionId).toBe("session-abc");
		expect(result.displayText).toContain("session-abc");
	});

	test("logsCore list returns multiple sessions sorted newest first", async () => {
		const older = createSessionLog("session-old", { startedAt: "2026-04-01T08:00:00Z" });
		const newer = createSessionLog("session-new", { startedAt: "2026-04-01T12:00:00Z" });
		await writeFile(join(testDir, "session-old.json"), JSON.stringify(older));
		await writeFile(join(testDir, "session-new.json"), JSON.stringify(newer));

		const result = JSON.parse(await logsCore("list", undefined, testDir));
		expect(result.sessions).toBeArrayOfSize(2);
		expect(result.sessions[0].sessionId).toBe("session-new");
		expect(result.sessions[1].sessionId).toBe("session-old");
	});

	test("logsCore detail with sessionID returns full log and summary", async () => {
		const log = createSessionLog("session-detail");
		await writeFile(join(testDir, "session-detail.json"), JSON.stringify(log));

		const result = JSON.parse(await logsCore("detail", { sessionID: "session-detail" }, testDir));
		expect(result.action).toBe("logs_detail");
		expect(result.sessionLog).toBeDefined();
		expect(result.summary).toContain("Session Summary");
		expect(result.displayText).toContain("Session Summary");
	});

	test("logsCore detail without sessionID uses latest session", async () => {
		const older = createSessionLog("session-old", { startedAt: "2026-04-01T08:00:00Z" });
		const newer = createSessionLog("session-latest", { startedAt: "2026-04-01T14:00:00Z" });
		await writeFile(join(testDir, "session-old.json"), JSON.stringify(older));
		await writeFile(join(testDir, "session-latest.json"), JSON.stringify(newer));

		const result = JSON.parse(await logsCore("detail", undefined, testDir));
		expect(result.action).toBe("logs_detail");
		expect(result.sessionLog.sessionId).toBe("session-latest");
	});

	test("logsCore search filters events by type", async () => {
		const log = createSessionLog("session-search", {
			events: [
				{
					type: "error",
					timestamp: "2026-04-01T10:05:00Z",
					sessionId: "session-search",
					errorType: "rate_limit",
					model: "claude-sonnet-4-20250514",
					message: "Rate limited",
				},
				{
					type: "decision",
					timestamp: "2026-04-01T10:10:00Z",
					sessionId: "session-search",
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "Use TDD",
					rationale: "Coverage",
				},
			],
		});
		await writeFile(join(testDir, "session-search.json"), JSON.stringify(log));

		const result = JSON.parse(
			await logsCore("search", { sessionID: "session-search", eventType: "error" }, testDir),
		);
		expect(result.action).toBe("logs_search");
		expect(result.events).toBeArrayOfSize(1);
		expect(result.events[0].type).toBe("error");
	});

	test("logsCore returns error when no logs found", async () => {
		const result = JSON.parse(await logsCore("list", undefined, testDir));
		expect(result.action).toBe("logs_list");
		expect(result.sessions).toBeArrayOfSize(0);
	});

	test("logsCore detail returns error when session not found", async () => {
		const result = JSON.parse(await logsCore("detail", { sessionID: "nonexistent" }, testDir));
		expect(result.action).toBe("error");
		expect(result.message).toContain("not found");
	});
});
