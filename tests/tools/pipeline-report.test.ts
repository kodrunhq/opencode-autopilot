import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { pipelineReportCore } from "../../src/tools/pipeline-report";

describe("oc_pipeline_report tool", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `report-test-${randomBytes(8).toString("hex")}`);
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

	test("pipelineReportCore returns report for latest session", async () => {
		const log = createSessionLog("session-report", {
			decisions: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					decision: "Research complete",
					rationale: "Found all info",
				},
			],
		});
		await writeFile(join(testDir, "session-report.json"), JSON.stringify(log));

		const result = JSON.parse(await pipelineReportCore(undefined, testDir));
		expect(result.action).toBe("pipeline_report");
		expect(result.sessionId).toBe("session-report");
		expect(result.phases).toBeDefined();
		expect(result.totalDecisions).toBe(1);
		expect(result.displayText).toContain("Pipeline Report");
	});

	test("pipelineReportCore returns report for specific session", async () => {
		const log = createSessionLog("session-specific", {
			decisions: [
				{
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "TDD approach",
					rationale: "Coverage",
				},
			],
		});
		await writeFile(join(testDir, "session-specific.json"), JSON.stringify(log));

		const result = JSON.parse(await pipelineReportCore("session-specific", testDir));
		expect(result.action).toBe("pipeline_report");
		expect(result.sessionId).toBe("session-specific");
	});

	test("pipelineReportCore returns error when session not found", async () => {
		const result = JSON.parse(await pipelineReportCore("nonexistent", testDir));
		expect(result.action).toBe("error");
		expect(result.message).toContain("not found");
	});

	test("pipelineReportCore groups decisions by phase", async () => {
		const log = createSessionLog("session-grouped", {
			decisions: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					decision: "Research done",
					rationale: "Data collected",
				},
				{
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "Implemented feature",
					rationale: "Tests pass",
				},
				{
					phase: "BUILD",
					agent: "oc-reviewer",
					decision: "Approved code",
					rationale: "Meets standards",
				},
			],
		});
		await writeFile(join(testDir, "session-grouped.json"), JSON.stringify(log));

		const result = JSON.parse(await pipelineReportCore("session-grouped", testDir));
		expect(result.phases).toBeArrayOfSize(2);
		expect(result.phases[0].phase).toBe("RECON");
		expect(result.phases[0].decisions).toBeArrayOfSize(1);
		expect(result.phases[1].phase).toBe("BUILD");
		expect(result.phases[1].decisions).toBeArrayOfSize(2);
		expect(result.totalDecisions).toBe(3);
	});

	test("pipelineReportCore returns empty phases when no decisions exist", async () => {
		const log = createSessionLog("session-no-decisions");
		await writeFile(join(testDir, "session-no-decisions.json"), JSON.stringify(log));

		const result = JSON.parse(await pipelineReportCore("session-no-decisions", testDir));
		expect(result.action).toBe("pipeline_report");
		expect(result.phases).toBeArrayOfSize(0);
		expect(result.totalDecisions).toBe(0);
	});

	test("displayText includes phase-by-phase breakdown", async () => {
		const log = createSessionLog("session-display", {
			decisions: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					decision: "Research complete",
					rationale: "Thorough analysis",
				},
				{
					phase: "BUILD",
					agent: "oc-implementer",
					decision: "Feature built",
					rationale: "TDD approach",
				},
			],
		});
		await writeFile(join(testDir, "session-display.json"), JSON.stringify(log));

		const result = JSON.parse(await pipelineReportCore("session-display", testDir));
		expect(result.displayText).toContain("RECON");
		expect(result.displayText).toContain("BUILD");
		expect(result.displayText).toContain("Research complete");
	});
});
