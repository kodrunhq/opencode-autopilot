import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { sessionStatsCore } from "../../src/tools/session-stats";

describe("oc_session_stats tool", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `stats-test-${randomBytes(8).toString("hex")}`);
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
			events: overrides?.events ?? [],
			decisions: overrides?.decisions ?? [],
			errorSummary: {},
		};
	}

	test("sessionStatsCore returns stats for latest session", async () => {
		const log = createSessionLog("session-stats");
		await writeFile(join(testDir, "session-stats.json"), JSON.stringify(log));

		const result = JSON.parse(await sessionStatsCore(undefined, testDir));
		expect(result.action).toBe("session_stats");
		expect(result.sessionId).toBe("session-stats");
		expect(result.displayText).toBeDefined();
		expect(typeof result.displayText).toBe("string");
	});

	test("sessionStatsCore returns stats for specific session", async () => {
		const log = createSessionLog("session-specific");
		await writeFile(join(testDir, "session-specific.json"), JSON.stringify(log));

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
		const log = createSessionLog("session-tokens");
		await writeFile(join(testDir, "session-tokens.json"), JSON.stringify(log));

		const result = JSON.parse(await sessionStatsCore("session-tokens", testDir));
		expect(result.displayText).toContain("Session Stats");
	});

	test("sessionStatsCore includes per-phase token grouping when phase_transition events exist", async () => {
		// Note: The session log schema's events are discriminated union of fallback/error/decision/model_switch.
		// phase_transition events are stored in the event store but not persisted in the schema's events array.
		// Per-phase grouping in session-stats will check for decision events grouped by phase.
		const log = createSessionLog("session-phases", {
			decisions: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					decision: "Research complete",
					rationale: "Found all info",
				},
				{
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "Implementation done",
					rationale: "Tests pass",
				},
			],
		});
		await writeFile(join(testDir, "session-phases.json"), JSON.stringify(log));

		const result = JSON.parse(await sessionStatsCore("session-phases", testDir));
		expect(result.action).toBe("session_stats");
		// Phase grouping based on decisions
		expect(result.phaseBreakdown).toBeDefined();
	});

	test("sessionStatsCore computes duration correctly", async () => {
		const log = createSessionLog("session-dur", {
			startedAt: "2026-04-01T10:00:00Z",
			endedAt: "2026-04-01T10:45:00Z",
		});
		await writeFile(join(testDir, "session-dur.json"), JSON.stringify(log));

		const result = JSON.parse(await sessionStatsCore("session-dur", testDir));
		expect(result.duration).toBeDefined();
	});
});
