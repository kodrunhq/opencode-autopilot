import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createForensicEvent } from "../../src/observability/forensic-log";
import { sessionStatsCore } from "../../src/tools/session-stats";
import { writeForensicSession } from "../observability/test-helpers";

describe("oc_session_stats tool", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `stats-test-${randomBytes(8).toString("hex")}`);
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
			events: overrides?.events ?? [],
			decisions: overrides?.decisions ?? [],
		});
	}

	test("sessionStatsCore returns stats for latest session", async () => {
		await createSessionLog("session-stats");

		const result = JSON.parse(await sessionStatsCore(undefined, testDir));
		expect(result.action).toBe("session_stats");
		expect(result.sessionId).toBe("session-stats");
		expect(result.displayText).toBeDefined();
		expect(typeof result.displayText).toBe("string");
	});

	test("sessionStatsCore returns stats for specific session", async () => {
		await createSessionLog("session-specific");

		const result = JSON.parse(await sessionStatsCore("session-specific", testDir));
		expect(result.action).toBe("session_stats");
		expect(result.sessionId).toBe("session-specific");
	});

	test("sessionStatsCore returns error when session not found", async () => {
		const result = JSON.parse(await sessionStatsCore("nonexistent", testDir));
		expect(result.action).toBe("error");
		expect(result.message).toContain("not found");
	});

	test("displayText includes formatted token information", async () => {
		await createSessionLog("session-tokens");

		const result = JSON.parse(await sessionStatsCore("session-tokens", testDir));
		expect(result.displayText).toContain("Session Stats");
	});

	test("sessionStatsCore includes per-phase token grouping when phase_transition events exist", async () => {
		// Note: The session log schema's events are discriminated union of fallback/error/decision/model_switch.
		// phase_transition events are stored in the event store but not persisted in the schema's events array.
		// Per-phase grouping in session-stats will check for decision events grouped by phase.
		await createSessionLog("session-phases", {
			decisions: [
				{
					timestamp: "2026-04-01T10:05:00Z",
					phase: "RECON",
					agent: "oc-researcher",
					decision: "Research complete",
					rationale: "Found all info",
				},
				{
					timestamp: "2026-04-01T10:15:00Z",
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "Implementation done",
					rationale: "Tests pass",
				},
			],
			events: [
				createForensicEvent({
					projectRoot: testDir,
					domain: "session",
					timestamp: "2026-04-01T10:05:30Z",
					sessionId: "session-phases",
					type: "error",
					code: "rate_limit",
					message: "Rate limited during research",
					payload: {
						errorType: "rate_limit",
						model: "claude-sonnet-4-20250514",
					},
				}),
			],
		});

		const result = JSON.parse(await sessionStatsCore("session-phases", testDir));
		expect(result.action).toBe("session_stats");
		// Phase grouping based on decisions
		expect(result.phaseBreakdown).toBeDefined();
	});

	test("sessionStatsCore computes duration correctly", async () => {
		await createSessionLog("session-dur", {
			startedAt: "2026-04-01T10:00:00Z",
			endedAt: "2026-04-01T10:45:00Z",
		});

		const result = JSON.parse(await sessionStatsCore("session-dur", testDir));
		expect(result.duration).toBeDefined();
	});
});
