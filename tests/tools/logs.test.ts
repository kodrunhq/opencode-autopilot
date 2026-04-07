import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createForensicEvent, resetDedupCache } from "../../src/observability/forensic-log";
import { logsCore } from "../../src/tools/logs";
import { writeForensicSession } from "../observability/test-helpers";

describe("oc_logs tool", () => {
	let testDir: string;

	beforeEach(async () => {
		resetDedupCache();
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

	describe("search mode - new filters", () => {
		const sessionId = "session-filters";

		beforeEach(async () => {
			await createSessionLog(sessionId, {
				events: [
					createForensicEvent({
						projectRoot: testDir,
						domain: "session",
						timestamp: "2026-04-01T10:05:00Z",
						sessionId,
						type: "error",
						message: "Rate limited",
						payload: { errorType: "rate_limit" },
					}),
					createForensicEvent({
						projectRoot: testDir,
						domain: "orchestrator",
						timestamp: "2026-04-01T10:10:00Z",
						sessionId,
						type: "warning",
						message: "Slow response",
						payload: { subsystem: "model-caller", severity: "warning" },
					}),
					createForensicEvent({
						projectRoot: testDir,
						domain: "orchestrator",
						timestamp: "2026-04-01T10:15:00Z",
						sessionId,
						type: "info",
						message: "Phase started",
						payload: { subsystem: "planner", level: "info" },
					}),
					createForensicEvent({
						projectRoot: testDir,
						domain: "review",
						timestamp: "2026-04-01T10:20:00Z",
						sessionId,
						type: "info",
						message: "Review complete",
						payload: { subsystem: "reviewer" },
					}),
				],
			});
		});

		test("filters by domain", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, domain: "orchestrator" }, testDir),
			);
			expect(result.action).toBe("logs_search");
			expect(result.events.every((e: { domain: string }) => e.domain === "orchestrator")).toBe(
				true,
			);
			expect(result.events.length).toBeGreaterThanOrEqual(2);
		});

		test("filters by subsystem via payload.subsystem", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, subsystem: "planner" }, testDir),
			);
			expect(result.action).toBe("logs_search");
			expect(result.events).toBeArrayOfSize(1);
			expect(result.events[0].payload.subsystem).toBe("planner");
		});

		test("filters by severity matching event.type", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, severity: "warning" }, testDir),
			);
			expect(result.action).toBe("logs_search");
			expect(result.events.length).toBeGreaterThanOrEqual(1);
			expect(
				result.events.every(
					(e: { type: string; payload: { severity?: string; level?: string } }) =>
						e.type === "warning" ||
						e.payload.severity === "warning" ||
						e.payload.level === "warning",
				),
			).toBe(true);
		});

		test("filters by severity matching payload.severity", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, severity: "warning" }, testDir),
			);
			expect(
				result.events.some(
					(e: { payload: { severity?: string } }) => e.payload.severity === "warning",
				),
			).toBe(true);
		});

		test("filters by severity matching payload.level", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, severity: "info" }, testDir),
			);
			expect(result.action).toBe("logs_search");
			expect(result.events.length).toBeGreaterThanOrEqual(1);
			expect(
				result.events.every(
					(e: { type: string; payload: { severity?: string; level?: string } }) =>
						e.type === "info" || e.payload.severity === "info" || e.payload.level === "info",
				),
			).toBe(true);
		});

		test("filters by time range - after", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, after: "2026-04-01T10:12:00Z" }, testDir),
			);
			expect(result.action).toBe("logs_search");
			expect(
				result.events.every((e: { timestamp: string }) => e.timestamp > "2026-04-01T10:12:00Z"),
			).toBe(true);
		});

		test("filters by time range - before", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, before: "2026-04-01T10:12:00Z" }, testDir),
			);
			expect(result.action).toBe("logs_search");
			expect(
				result.events.every((e: { timestamp: string }) => e.timestamp < "2026-04-01T10:12:00Z"),
			).toBe(true);
		});

		test("combines domain and severity filters", async () => {
			const result = JSON.parse(
				await logsCore(
					"search",
					{ sessionID: sessionId, domain: "orchestrator", severity: "warning" },
					testDir,
				),
			);
			expect(result.action).toBe("logs_search");
			expect(
				result.events.every(
					(e: { domain: string; type: string; payload: { severity?: string; level?: string } }) =>
						e.domain === "orchestrator" &&
						(e.type === "warning" ||
							e.payload.severity === "warning" ||
							e.payload.level === "warning"),
				),
			).toBe(true);
		});

		test("combines domain, subsystem, and severity filters end-to-end", async () => {
			const result = JSON.parse(
				await logsCore(
					"search",
					{
						sessionID: sessionId,
						domain: "orchestrator",
						subsystem: "planner",
						severity: "info",
					},
					testDir,
				),
			);

			expect(result.action).toBe("logs_search");
			expect(result.events).toBeArrayOfSize(1);
			expect(result.events[0].domain).toBe("orchestrator");
			expect(result.events[0].payload.subsystem).toBe("planner");
			expect(result.events[0].type).toBe("info");
		});

		test("search result includes matchCount and filters fields", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, domain: "review" }, testDir),
			);
			expect(result.matchCount).toBeDefined();
			expect(result.filters).toBeDefined();
			expect(result.filters.domain).toBe("review");
			expect(result.matchCount).toBe(result.events.length);
		});

		test("search result includes displayText with event count", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, domain: "review" }, testDir),
			);
			expect(result.displayText).toContain("Search Results");
			expect(result.displayText).toContain(`${result.matchCount} event`);
		});

		test("no matching events returns empty events array", async () => {
			const result = JSON.parse(
				await logsCore("search", { sessionID: sessionId, subsystem: "nonexistent" }, testDir),
			);
			expect(result.action).toBe("logs_search");
			expect(result.events).toBeArrayOfSize(0);
			expect(result.matchCount).toBe(0);
		});
	});
});
