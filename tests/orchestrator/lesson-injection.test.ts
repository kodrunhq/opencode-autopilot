import { describe, expect, test } from "bun:test";
import type { Lesson, LessonDomain } from "../../src/orchestrator/lesson-types";
import {
	buildLessonContext,
	PHASE_LESSON_DOMAINS,
} from "../../src/orchestrator/lesson-injection";
import { PHASES } from "../../src/orchestrator/schemas";

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
	return {
		content: "Test lesson content",
		domain: "architecture" as LessonDomain,
		extractedAt: new Date().toISOString(),
		sourcePhase: "BUILD",
		...overrides,
	};
}

describe("PHASE_LESSON_DOMAINS", () => {
	test("has entries for all 8 phases", () => {
		for (const phase of PHASES) {
			expect(PHASE_LESSON_DOMAINS).toHaveProperty(phase);
			expect(Array.isArray(PHASE_LESSON_DOMAINS[phase])).toBe(true);
		}
	});

	test("EXPLORE maps to empty domains", () => {
		expect(PHASE_LESSON_DOMAINS.EXPLORE).toEqual([]);
	});

	test("RETROSPECTIVE maps to empty domains", () => {
		expect(PHASE_LESSON_DOMAINS.RETROSPECTIVE).toEqual([]);
	});

	test("ARCHITECT maps to architecture domain", () => {
		expect(PHASE_LESSON_DOMAINS.ARCHITECT).toContain("architecture");
	});

	test("BUILD maps to testing and review domains", () => {
		expect(PHASE_LESSON_DOMAINS.BUILD).toContain("testing");
		expect(PHASE_LESSON_DOMAINS.BUILD).toContain("review");
	});
});

describe("buildLessonContext", () => {
	test("with matching architecture lesson for ARCHITECT returns formatted context", () => {
		const lessons = [makeLesson({ content: "Modular designs scale better", domain: "architecture" })];
		const result = buildLessonContext(lessons, "ARCHITECT");

		expect(result).toContain("Prior lessons from previous runs:");
		expect(result).toContain("[architecture]");
		expect(result).toContain("Modular designs scale better");
	});

	test("with testing lesson for ARCHITECT returns empty (wrong domain)", () => {
		const lessons = [makeLesson({ content: "Test coverage matters", domain: "testing" })];
		const result = buildLessonContext(lessons, "ARCHITECT");

		expect(result).toBe("");
	});

	test("with empty lessons array returns empty string", () => {
		const result = buildLessonContext([], "ARCHITECT");
		expect(result).toBe("");
	});

	test("for EXPLORE phase returns empty (no domains)", () => {
		const lessons = [makeLesson({ domain: "architecture" }), makeLesson({ domain: "testing" })];
		const result = buildLessonContext(lessons, "EXPLORE");

		expect(result).toBe("");
	});

	test("truncates content longer than 256 chars", () => {
		const longContent = "A".repeat(300);
		const lessons = [makeLesson({ content: longContent, domain: "architecture" })];
		const result = buildLessonContext(lessons, "ARCHITECT");

		expect(result).toContain("...");
		// Should not contain the full 300-char string
		expect(result).not.toContain(longContent);
	});

	test("caps at 10 lessons", () => {
		const lessons = Array.from({ length: 15 }, (_, i) =>
			makeLesson({
				content: `Lesson number ${i}`,
				domain: "architecture",
				extractedAt: new Date(Date.now() - i * 1000).toISOString(),
			}),
		);
		const result = buildLessonContext(lessons, "ARCHITECT");

		// Count occurrences of "[architecture]"
		const matches = result.match(/\[architecture\]/g);
		expect(matches).toHaveLength(10);
	});

	test("sanitizes content (strips {{PLACEHOLDER}} tokens)", () => {
		const lessons = [
			makeLesson({
				content: "Use {{PRIOR_FINDINGS}} for injection test",
				domain: "architecture",
			}),
		];
		const result = buildLessonContext(lessons, "ARCHITECT");

		expect(result).not.toContain("{{PRIOR_FINDINGS}}");
		expect(result).toContain("[REDACTED]");
	});

	test("sorts by extractedAt descending (newest first)", () => {
		const lessons = [
			makeLesson({
				content: "Older lesson",
				domain: "architecture",
				extractedAt: "2026-03-01T00:00:00.000Z",
			}),
			makeLesson({
				content: "Newer lesson",
				domain: "architecture",
				extractedAt: "2026-03-31T00:00:00.000Z",
			}),
		];
		const result = buildLessonContext(lessons, "ARCHITECT");

		const newerIndex = result.indexOf("Newer lesson");
		const olderIndex = result.indexOf("Older lesson");
		expect(newerIndex).toBeLessThan(olderIndex);
	});
});
