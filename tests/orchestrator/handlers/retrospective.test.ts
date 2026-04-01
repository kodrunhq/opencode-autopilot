import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Lesson, LessonDomain, LessonMemory } from "../../../src/orchestrator/lesson-types";

// Mock lesson-memory module before importing handler
const mockLoadLessonMemory = mock(() => Promise.resolve(null as LessonMemory | null));
const mockSaveLessonMemory = mock((_memory: LessonMemory, _dir?: string) => Promise.resolve());
const mockCreateEmptyLessonMemory = mock(
	(): LessonMemory => ({
		schemaVersion: 1 as const,
		lessons: [],
		lastUpdatedAt: null,
	}),
);

mock.module("../../../src/orchestrator/lesson-memory", () => ({
	loadLessonMemory: mockLoadLessonMemory,
	saveLessonMemory: mockSaveLessonMemory,
	createEmptyLessonMemory: mockCreateEmptyLessonMemory,
}));

import { handleRetrospective } from "../../../src/orchestrator/handlers/retrospective";
import type { PipelineState } from "../../../src/orchestrator/types";

function makeState(overrides: Partial<PipelineState> = {}): PipelineState {
	return {
		schemaVersion: 2 as const,
		idea: "Test idea",
		currentPhase: "RETROSPECTIVE",
		status: "IN_PROGRESS",
		phaseResults: {},
		decisions: [],
		confidence: { overall: "HIGH", entries: [] },
		arena: null,
		build: {
			tasks: [],
			currentTaskIndex: 0,
			completedWaves: [],
			reviewOutcome: null,
		},
		...overrides,
	} as PipelineState;
}

function makeValidLessonsJson(
	lessons: Array<{ content: string; domain: string; sourcePhase: string }>,
): string {
	return JSON.stringify({ lessons });
}

describe("handleRetrospective", () => {
	beforeEach(() => {
		mockLoadLessonMemory.mockReset();
		mockSaveLessonMemory.mockReset();
		mockCreateEmptyLessonMemory.mockReset();
		mockLoadLessonMemory.mockResolvedValue(null);
		mockSaveLessonMemory.mockResolvedValue(undefined);
		mockCreateEmptyLessonMemory.mockReturnValue({
			schemaVersion: 1 as const,
			lessons: [],
			lastUpdatedAt: null,
		});
	});

	test("with valid JSON result containing 3 lessons persists them", async () => {
		const state = makeState();
		const result = makeValidLessonsJson([
			{
				content: "Modular designs scale better",
				domain: "architecture",
				sourcePhase: "ARCHITECT",
			},
			{
				content: "Test coverage above 80% catches regressions",
				domain: "testing",
				sourcePhase: "BUILD",
			},
			{
				content: "Plan decomposition improves estimation",
				domain: "planning",
				sourcePhase: "PLAN",
			},
		]);

		const dispatch = await handleRetrospective(state, "/tmp/test-artifacts", result);

		expect(dispatch.action).toBe("complete");
		expect(dispatch.phase).toBe("RETROSPECTIVE");
		expect(dispatch.progress).toContain("3 lessons extracted");
		expect(mockSaveLessonMemory).toHaveBeenCalledTimes(1);

		// Verify the saved memory contains the 3 lessons with extractedAt set
		const savedMemory = mockSaveLessonMemory.mock.calls[0][0] as LessonMemory;
		expect(savedMemory.lessons).toHaveLength(3);
		for (const lesson of savedMemory.lessons) {
			expect(lesson.extractedAt).toBeTruthy();
			expect(typeof lesson.extractedAt).toBe("string");
		}
	});

	test("with malformed JSON returns complete gracefully", async () => {
		const state = makeState();
		const result = "this is not valid JSON {{{";

		const dispatch = await handleRetrospective(state, "/tmp/test-artifacts", result);

		expect(dispatch.action).toBe("complete");
		expect(dispatch.phase).toBe("RETROSPECTIVE");
		expect(dispatch.progress).toContain("parse error");
		expect(mockSaveLessonMemory).not.toHaveBeenCalled();
	});

	test("with invalid domain in one lesson skips that lesson, persists valid ones", async () => {
		const state = makeState();
		const result = JSON.stringify({
			lessons: [
				{
					content: "Valid architecture lesson",
					domain: "architecture",
					sourcePhase: "ARCHITECT",
				},
				{
					content: "Invalid domain lesson",
					domain: "invalid-domain",
					sourcePhase: "BUILD",
				},
				{
					content: "Valid testing lesson",
					domain: "testing",
					sourcePhase: "BUILD",
				},
			],
		});

		const dispatch = await handleRetrospective(state, "/tmp/test-artifacts", result);

		expect(dispatch.action).toBe("complete");
		expect(dispatch.progress).toContain("2 lessons extracted");
		expect(mockSaveLessonMemory).toHaveBeenCalledTimes(1);

		const savedMemory = mockSaveLessonMemory.mock.calls[0][0] as LessonMemory;
		expect(savedMemory.lessons).toHaveLength(2);
		expect(savedMemory.lessons.every((l) => (l.domain as string) !== "invalid-domain")).toBe(true);
	});

	test("without result returns dispatch action with oc-retrospector agent", async () => {
		const state = makeState();

		const dispatch = await handleRetrospective(state, "/tmp/test-artifacts");

		expect(dispatch.action).toBe("dispatch");
		expect(dispatch.agent).toBe("oc-retrospector");
		expect(dispatch.prompt).toBeTruthy();
		expect(dispatch.phase).toBe("RETROSPECTIVE");
	});

	test("merges new lessons with existing lesson memory", async () => {
		const existingLesson: Lesson = {
			content: "Existing lesson",
			domain: "review" as LessonDomain,
			extractedAt: "2026-03-30T00:00:00.000Z",
			sourcePhase: "BUILD",
		};
		mockLoadLessonMemory.mockResolvedValue({
			schemaVersion: 1 as const,
			lessons: [existingLesson],
			lastUpdatedAt: "2026-03-30T00:00:00.000Z",
		});

		const state = makeState();
		const result = makeValidLessonsJson([
			{ content: "New lesson", domain: "architecture", sourcePhase: "ARCHITECT" },
		]);

		const dispatch = await handleRetrospective(state, "/tmp/test-artifacts", result);

		expect(dispatch.action).toBe("complete");
		expect(mockSaveLessonMemory).toHaveBeenCalledTimes(1);

		const savedMemory = mockSaveLessonMemory.mock.calls[0][0] as LessonMemory;
		expect(savedMemory.lessons).toHaveLength(2);
	});

	test("parses JSON wrapped in markdown code fences", async () => {
		const lessons = JSON.stringify({
			lessons: [{ content: "Test lesson", domain: "architecture", sourcePhase: "BUILD" }],
		});
		const fenced = `\`\`\`json\n${lessons}\n\`\`\``;
		const state = makeState();
		const result = await handleRetrospective(state, "/tmp/test-artifacts", fenced);
		expect(result.action).toBe("complete");
		expect(result.progress).toContain("1 lessons extracted");
	});

	test("returns complete with 0 lessons when all lessons have invalid domains", async () => {
		const state = makeState();
		const result = JSON.stringify({
			lessons: [{ content: "Bad", domain: "unknown", sourcePhase: "BUILD" }],
		});

		const dispatch = await handleRetrospective(state, "/tmp/test-artifacts", result);

		expect(dispatch.action).toBe("complete");
		expect(dispatch.progress).toContain("0 lessons extracted");
		// Should not save when there are no valid lessons and no existing memory
		expect(mockSaveLessonMemory).not.toHaveBeenCalled();
	});
});
