import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createForensicEvent } from "../../src/observability/forensic-log";
import { logsCore } from "../../src/tools/logs";
import { writeForensicSession } from "../observability/test-helpers";

describe("oc_logs tool", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `logs-test-${randomBytes(8).toString("hex")}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	async function createSessionLog(
		sessionId: string,
		overrides?: Partial<{
			startedAt: string;
			endedAt: string | null;
			events: ReturnType<typeof createForensicEvent>[];
			decisions: Parameters<typeof writeForensicSession>[0]["decisions"];
		}>,
	): Promise<void> {
		await writeForensicSession({
			projectRoot: testDir,
			sessionId,
			startedAt: overrides?.startedAt ?? "2026-04-01T10:00:00Z",
			endedAt: overrides?.endedAt ?? "2026-04-01T10:30:00Z",
			events: overrides?.events ?? [
				createForensicEvent({
					projectRoot: testDir,
					domain: "session",
					timestamp: "2026-04-01T10:05:00Z",
					sessionId,
					type: "error",
					code: "rate_limit",
					message: "Rate limited",
					payload: {
						errorType: "rate_limit",
						model: "claude-sonnet-4-20250514",
					},
				}),
			],
			decisions: overrides?.decisions ?? [
				{
					timestamp: null,
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "Use TDD approach",
					rationale: "Test coverage requirement",
				},
			],
		});
	}

	test("logsCore list returns session list with displayText", async () => {
		await createSessionLog("session-abc");

		const result = JSON.parse(await logsCore("list", undefined, testDir));
		expect(result.action).toBe("logs_list");
		expect(result.sessions).toBeArrayOfSize(1);
		expect(result.sessions[0].sessionId).toBe("session-abc");
		expect(result.displayText).toContain("session-abc");
	});

	test("logsCore list returns multiple sessions sorted newest first", async () => {
		await createSessionLog("session-old", { startedAt: "2026-04-01T08:00:00Z" });
		await createSessionLog("session-new", { startedAt: "2026-04-01T12:00:00Z" });

		const result = JSON.parse(await logsCore("list", undefined, testDir));
		expect(result.sessions).toBeArrayOfSize(2);
		expect(result.sessions[0].sessionId).toBe("session-new");
		expect(result.sessions[1].sessionId).toBe("session-old");
	});

	test("logsCore detail with sessionID returns full log and summary", async () => {
		await createSessionLog("session-detail");

		const result = JSON.parse(await logsCore("detail", { sessionID: "session-detail" }, testDir));
		expect(result.action).toBe("logs_detail");
		expect(result.sessionLog).toBeDefined();
		expect(result.summary).toContain("Session Summary");
		expect(result.displayText).toContain("Session Summary");
	});

	test("logsCore detail without sessionID uses latest session", async () => {
		await createSessionLog("session-old", { startedAt: "2026-04-01T08:00:00Z" });
		await createSessionLog("session-latest", { startedAt: "2026-04-01T14:00:00Z" });

		const result = JSON.parse(await logsCore("detail", undefined, testDir));
		expect(result.action).toBe("logs_detail");
		expect(result.sessionLog.sessionId).toBe("session-latest");
	});

	test("logsCore search filters events by type", async () => {
		await createSessionLog("session-search", {
			events: [
				createForensicEvent({
					projectRoot: testDir,
					domain: "session",
					timestamp: "2026-04-01T10:05:00Z",
					sessionId: "session-search",
					type: "error",
					code: "rate_limit",
					message: "Rate limited",
					payload: {
						errorType: "rate_limit",
						model: "claude-sonnet-4-20250514",
					},
				}),
			],
		});

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
