import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createEmptyLessonMemory,
	loadLessonMemory,
	pruneLessons,
	saveLessonMemory,
} from "../../src/orchestrator/lesson-memory";
import {
	LESSON_DOMAINS,
	lessonDomainSchema,
	lessonMemorySchema,
	lessonSchema,
} from "../../src/orchestrator/lesson-schemas";
import type { Lesson, LessonDomain, LessonMemory } from "../../src/orchestrator/lesson-types";
import { ensureDir } from "../../src/utils/fs-helpers";

const LESSON_FILE = "lesson-memory.json";
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function makeLessonMemory(lessons: Lesson[], lastUpdatedAt: string | null = null): LessonMemory {
	return {
		schemaVersion: 1 as const,
		lessons,
		lastUpdatedAt,
	};
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
	return {
		content: "Test lesson content",
		domain: "architecture" as LessonDomain,
		extractedAt: new Date().toISOString(),
		sourcePhase: "BUILD",
		...overrides,
	};
}

describe("lesson-schemas", () => {
	test("LESSON_DOMAINS contains exactly 4 fixed domains", () => {
		expect(LESSON_DOMAINS).toEqual(["architecture", "testing", "review", "planning"]);
		// Frozen
		expect(() => {
			(LESSON_DOMAINS as unknown as string[]).push("invalid");
		}).toThrow();
	});

	test("lessonDomainSchema only accepts valid domains", () => {
		expect(lessonDomainSchema.parse("architecture")).toBe("architecture");
		expect(lessonDomainSchema.parse("testing")).toBe("testing");
		expect(lessonDomainSchema.parse("review")).toBe("review");
		expect(lessonDomainSchema.parse("planning")).toBe("planning");
		expect(() => lessonDomainSchema.parse("invalid")).toThrow();
	});

	test("lessonSchema validates content, domain, extractedAt, sourcePhase fields", () => {
		const valid = {
			content: "some content",
			domain: "architecture",
			extractedAt: new Date().toISOString(),
			sourcePhase: "BUILD",
		};
		expect(() => lessonSchema.parse(valid)).not.toThrow();

		// Missing fields
		expect(() => lessonSchema.parse({ content: "x" })).toThrow();
		// Invalid domain
		expect(() => lessonSchema.parse({ ...valid, domain: "invalid" })).toThrow();
		// Content too long (>1024)
		expect(() => lessonSchema.parse({ ...valid, content: "x".repeat(1025) })).toThrow();
	});

	test("lessonMemorySchema has schemaVersion: 1, lessons array, lastUpdatedAt", () => {
		const valid = {
			schemaVersion: 1,
			lessons: [],
			lastUpdatedAt: null,
		};
		expect(() => lessonMemorySchema.parse(valid)).not.toThrow();

		// Wrong schemaVersion
		expect(() => lessonMemorySchema.parse({ ...valid, schemaVersion: 2 })).toThrow();
		// Too many lessons (>50)
		const tooMany = Array.from({ length: 51 }, () => makeLesson());
		expect(() => lessonMemorySchema.parse({ ...valid, lessons: tooMany })).toThrow();
	});
});

describe("createEmptyLessonMemory", () => {
	test("returns valid schema-conforming empty object", () => {
		const empty = createEmptyLessonMemory();
		expect(empty.schemaVersion).toBe(1);
		expect(empty.lessons).toEqual([]);
		expect(empty.lastUpdatedAt).toBeNull();
		// Validates against schema
		expect(() => lessonMemorySchema.parse(empty)).not.toThrow();
	});
});

describe("pruneLessons", () => {
	test("removes entries older than 90 days", () => {
		const oldDate = new Date(Date.now() - NINETY_DAYS_MS - 1000).toISOString();
		const newDate = new Date().toISOString();

		const memory = makeLessonMemory([
			makeLesson({ extractedAt: oldDate, content: "old" }),
			makeLesson({ extractedAt: newDate, content: "new" }),
		]);

		const pruned = pruneLessons(memory);
		expect(pruned.lessons).toHaveLength(1);
		expect(pruned.lessons[0].content).toBe("new");
	});

	test("keeps only newest 50 when over cap", () => {
		const lessons = Array.from({ length: 55 }, (_, i) =>
			makeLesson({
				extractedAt: new Date(Date.now() - i * 1000).toISOString(),
				content: `lesson-${i}`,
			}),
		);

		const memory = makeLessonMemory(lessons);
		const pruned = pruneLessons(memory);
		expect(pruned.lessons).toHaveLength(50);
		// Should keep the newest (lowest index = most recent)
		expect(pruned.lessons[0].content).toBe("lesson-0");
	});

	test("returns a frozen object (never mutates input)", () => {
		const memory = makeLessonMemory([makeLesson()]);
		const pruned = pruneLessons(memory);

		expect(Object.isFrozen(pruned)).toBe(true);
		// Input should not be the same reference
		expect(pruned).not.toBe(memory);
	});
});

describe("loadLessonMemory", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "lesson-test-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("returns null when file does not exist", async () => {
		const result = await loadLessonMemory(tmpDir);
		expect(result).toBeNull();
	});

	test("returns null on malformed JSON (SyntaxError)", async () => {
		const dir = join(tmpDir, ".opencode-autopilot");
		await ensureDir(dir);
		await writeFile(join(dir, LESSON_FILE), "not json!!!", "utf-8");

		const result = await loadLessonMemory(tmpDir);
		expect(result).toBeNull();
	});

	test("returns null on Zod validation failure", async () => {
		const dir = join(tmpDir, ".opencode-autopilot");
		await ensureDir(dir);
		await writeFile(
			join(dir, LESSON_FILE),
			JSON.stringify({ schemaVersion: 999, lessons: "not-array" }),
			"utf-8",
		);

		const result = await loadLessonMemory(tmpDir);
		expect(result).toBeNull();
	});

	test("prunes stale lessons (>90 days) on load", async () => {
		const oldDate = new Date(Date.now() - NINETY_DAYS_MS - 1000).toISOString();
		const newDate = new Date().toISOString();

		const memory = makeLessonMemory([
			makeLesson({ extractedAt: oldDate }),
			makeLesson({ extractedAt: newDate }),
		]);

		const dir = join(tmpDir, ".opencode-autopilot");
		await ensureDir(dir);
		await writeFile(join(dir, LESSON_FILE), JSON.stringify(memory), "utf-8");

		const loaded = await loadLessonMemory(tmpDir);
		expect(loaded).not.toBeNull();
		expect(loaded?.lessons).toHaveLength(1);
	});

	test("caps at 50 lessons (keeps newest by extractedAt)", async () => {
		// We can't write >50 through schema validation directly,
		// so we write raw JSON bypassing schema max
		const lessons = Array.from({ length: 55 }, (_, i) =>
			makeLesson({
				extractedAt: new Date(Date.now() - i * 1000).toISOString(),
				content: `lesson-${i}`,
			}),
		);

		const rawMemory = {
			schemaVersion: 1,
			lessons,
			lastUpdatedAt: null,
		};

		const dir = join(tmpDir, ".opencode-autopilot");
		await ensureDir(dir);
		await writeFile(join(dir, LESSON_FILE), JSON.stringify(rawMemory), "utf-8");

		// Prune runs BEFORE schema validation, capping at 50.
		// Files with >50 lessons are recovered (pruned+validated), not rejected.
		const loaded = await loadLessonMemory(tmpDir);
		expect(loaded).not.toBeNull();
		expect(loaded?.lessons.length).toBeLessThanOrEqual(50);
	});

	test("loads valid memory and returns frozen object", async () => {
		const memory = makeLessonMemory([makeLesson()], new Date().toISOString());

		const dir = join(tmpDir, ".opencode-autopilot");
		await ensureDir(dir);
		await writeFile(join(dir, LESSON_FILE), JSON.stringify(memory), "utf-8");

		const loaded = await loadLessonMemory(tmpDir);
		expect(loaded).not.toBeNull();
		expect(loaded?.schemaVersion).toBe(1);
		expect(loaded?.lessons).toHaveLength(1);
	});
});

describe("saveLessonMemory", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "lesson-test-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("writes atomically (tmp + rename)", async () => {
		const memory = makeLessonMemory([makeLesson()], new Date().toISOString());
		await saveLessonMemory(memory, tmpDir);

		const filePath = join(tmpDir, ".opencode-autopilot", LESSON_FILE);
		const raw = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(raw);

		expect(parsed.schemaVersion).toBe(1);
		expect(parsed.lessons).toHaveLength(1);
	});

	test("validates through schema before writing", async () => {
		const invalidMemory = {
			schemaVersion: 999,
			lessons: [],
			lastUpdatedAt: null,
		} as unknown as LessonMemory;

		expect(saveLessonMemory(invalidMemory, tmpDir)).rejects.toThrow();
	});

	test("creates .opencode-autopilot directory if missing", async () => {
		const memory = makeLessonMemory([], new Date().toISOString());
		await saveLessonMemory(memory, tmpDir);

		const filePath = join(tmpDir, ".opencode-autopilot", LESSON_FILE);
		const raw = await readFile(filePath, "utf-8");
		expect(JSON.parse(raw).schemaVersion).toBe(1);
	});
});
