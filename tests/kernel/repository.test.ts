import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKernelDb } from "../../src/kernel/database";
import {
	appendForensicEventsToKernel,
	clearActiveReviewStateInKernel,
	countForensicEventsInKernel,
	loadActiveReviewStateFromKernel,
	loadForensicEventsFromKernel,
	loadLatestPipelineStateFromKernel,
	loadLatestReviewRunFromKernel,
	loadLessonMemoryFromKernel,
	loadReviewMemoryFromKernel,
	loadReviewRunFromKernel,
	saveActiveReviewStateToKernel,
	saveLessonMemoryToKernel,
	savePipelineStateToKernel,
	saveReviewMemoryToKernel,
	saveReviewRunToKernel,
} from "../../src/kernel/repository";
import { createForensicEvent } from "../../src/observability/forensic-log";
import { createEmptyLessonMemory } from "../../src/orchestrator/lesson-memory";
import { reviewRunSchema } from "../../src/orchestrator/review-runner";
import { createInitialState, patchState } from "../../src/orchestrator/state";
import { createEmptyMemory } from "../../src/review/memory";
import { reviewStateSchema } from "../../src/review/schemas";

let artifactDir: string;

beforeEach(async () => {
	artifactDir = await mkdtemp(join(tmpdir(), "kernel-test-"));
});

afterEach(async () => {
	await rm(artifactDir, { recursive: true, force: true });
});

describe("kernel repository", () => {
	test("creates kernel schema on first open", () => {
		const db = openKernelDb(artifactDir);
		try {
			const tables = db
				.query(
					"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pipeline_runs', 'forensic_events', 'active_review_state', 'review_runs', 'review_findings')",
				)
				.all() as Array<{ name: string }>;
			expect(tables.map((row) => row.name).sort()).toEqual([
				"active_review_state",
				"forensic_events",
				"pipeline_runs",
				"review_findings",
				"review_runs",
			]);
		} finally {
			db.close();
		}
	});

	test("round-trips pipeline state through the kernel", () => {
		const state = patchState(createInitialState("kernel state"), {
			exploreTriggered: true,
		});

		savePipelineStateToKernel(artifactDir, state);

		const loaded = loadLatestPipelineStateFromKernel(artifactDir);
		expect(loaded).toEqual(state);
	});

	test("enforces expected revision conflict in the kernel", () => {
		const initial = createInitialState("kernel conflict");
		savePipelineStateToKernel(artifactDir, initial);

		const advanced = patchState(initial, { exploreTriggered: true });
		expect(() => savePipelineStateToKernel(artifactDir, advanced, 99)).toThrow("E_STATE_CONFLICT");
	});

	test("stores and reads forensic events from the kernel", () => {
		const event = createForensicEvent({
			projectRoot: join(artifactDir, ".."),
			domain: "orchestrator",
			timestamp: "2026-04-04T12:00:00.000Z",
			runId: "run_test",
			phase: "RECON",
			type: "dispatch",
			message: "dispatch issued",
		});

		appendForensicEventsToKernel(artifactDir, [event]);

		expect(countForensicEventsInKernel(artifactDir)).toBe(1);
		expect(loadForensicEventsFromKernel(artifactDir)).toEqual([event]);
	});

	test("stores and clears active review state in the kernel", () => {
		const reviewState = reviewStateSchema.parse({
			stage: 2,
			selectedAgentNames: ["logic-auditor", "security-auditor"],
			accumulatedFindings: [],
			scope: "branch",
			startedAt: "2026-04-04T12:30:00.000Z",
		});

		saveActiveReviewStateToKernel(artifactDir, reviewState);
		expect(loadActiveReviewStateFromKernel(artifactDir)).toEqual(reviewState);

		clearActiveReviewStateInKernel(artifactDir);
		expect(loadActiveReviewStateFromKernel(artifactDir)).toBeNull();
	});

	test("stores review memory in the kernel", () => {
		const memory = {
			...createEmptyMemory(),
			lastReviewedAt: "2026-04-04T12:40:00.000Z",
		};

		saveReviewMemoryToKernel(artifactDir, memory);
		expect(loadReviewMemoryFromKernel(artifactDir)).toEqual(memory);
	});

	test("stores and loads structured review runs with findings", () => {
		const reviewRun = reviewRunSchema.parse({
			reviewRunId: "review_test_1",
			runId: "run_test_1",
			trancheId: "tranche_test_1",
			scope: "branch",
			status: "BLOCKED",
			verdict: "BLOCKED",
			policy: {
				requiredReviewers: ["logic-auditor", "security-auditor"],
				blockingSeverityThreshold: "HIGH",
				allowedWaivers: [],
			},
			selectedReviewers: ["logic-auditor", "security-auditor"],
			reviewers: [
				{
					reviewer: "logic-auditor",
					required: true,
					status: "COMPLETED",
					findingsCount: 1,
					startedAt: "2026-04-12T12:00:00.000Z",
					completedAt: "2026-04-12T12:05:00.000Z",
				},
				{
					reviewer: "security-auditor",
					required: true,
					status: "FAILED",
					findingsCount: 0,
					startedAt: "2026-04-12T12:00:00.000Z",
					completedAt: "2026-04-12T12:05:00.000Z",
				},
			],
			findings: [
				{
					findingId: "review_test_1_finding_1",
					reviewRunId: "review_test_1",
					reviewer: "logic-auditor",
					severity: "HIGH",
					file: "src/example.ts",
					line: 42,
					title: "Unhandled edge case",
					detail: "Problem: missing null guard",
					status: "open",
				},
			],
			findingsSummary: {
				CRITICAL: 0,
				HIGH: 1,
				MEDIUM: 0,
				LOW: 0,
				open: 1,
				accepted: 0,
				fixed: 0,
				blockingOpen: 1,
			},
			summary: "1 HIGH finding; required security review missing.",
			blockedReason: "Required reviewers did not execute: security-auditor",
			startedAt: "2026-04-12T12:00:00.000Z",
			completedAt: "2026-04-12T12:05:00.000Z",
		});

		saveReviewRunToKernel(artifactDir, reviewRun);

		expect(loadReviewRunFromKernel(artifactDir, reviewRun.reviewRunId)).toEqual(reviewRun);
		expect(
			loadLatestReviewRunFromKernel(artifactDir, { runId: reviewRun.runId ?? undefined }),
		).toEqual(reviewRun);
	});

	test("stores lesson memory in the kernel", () => {
		const lessonMemory = {
			...createEmptyLessonMemory(),
			lessons: [
				{
					content: "Keep build reviews scoped and deterministic",
					domain: "review" as const,
					extractedAt: "2026-04-04T12:45:00.000Z",
					sourcePhase: "RETROSPECTIVE" as const,
				},
			],
			lastUpdatedAt: "2026-04-04T12:45:00.000Z",
		};

		saveLessonMemoryToKernel(artifactDir, lessonMemory);
		expect(loadLessonMemoryFromKernel(artifactDir)).toEqual(lessonMemory);

		const db = openKernelDb(artifactDir, { readonly: true });
		try {
			const rows = db
				.query("SELECT content, domain, source_phase FROM project_lessons")
				.all() as Array<{ content: string; domain: string; source_phase: string }>;
			expect(rows).toHaveLength(1);
			expect(rows[0]?.content).toContain("deterministic");
			expect(rows[0]?.domain).toBe("review");
			expect(rows[0]?.source_phase).toBe("RETROSPECTIVE");
		} finally {
			db.close();
		}
	});
});
