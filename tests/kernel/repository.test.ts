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
	loadLessonMemoryFromKernel,
	loadReviewMemoryFromKernel,
	saveActiveReviewStateToKernel,
	saveLessonMemoryToKernel,
	savePipelineStateToKernel,
	saveReviewMemoryToKernel,
} from "../../src/kernel/repository";
import { createForensicEvent } from "../../src/observability/forensic-log";
import { createEmptyLessonMemory } from "../../src/orchestrator/lesson-memory";
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
					"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pipeline_runs', 'forensic_events', 'active_review_state')",
				)
				.all() as Array<{ name: string }>;
			expect(tables.map((row) => row.name).sort()).toEqual([
				"active_review_state",
				"forensic_events",
				"pipeline_runs",
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
