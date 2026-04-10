import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { buildMemoryContextV2 } from "../../src/memory/retrieval";
import type { Memory } from "../../src/memory/types";
import { memorySaveCore } from "../../src/tools/memory-save";
import { memorySearchCore } from "../../src/tools/memory-search";

describe("memory metadata tool surface", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("memorySaveCore accepts topicGroup and topic", () => {
		const result = memorySaveCore(
			{
				kind: "decision",
				content: "Use PostgreSQL",
				summary: "PostgreSQL",
				topicGroup: "architecture",
				topic: "database",
			},
			"/tmp/project",
			db,
		);

		expect(result.ok).toBe(true);
		expect(result.memory?.topicGroup).toBe("architecture");
		expect(result.memory?.topic).toBe("database");
	});

	test("memorySaveCore accepts sourceKind", () => {
		const result = memorySaveCore(
			{
				kind: "project_fact",
				content: "Uses GitHub Actions",
				summary: "GitHub Actions",
				sourceKind: "raw_attachment",
			},
			"/tmp/project",
			db,
		);

		expect(result.ok).toBe(true);
		expect(result.memory?.sourceKind).toBe("raw_attachment");
	});

	test("memorySearchCore filters by topicGroup", () => {
		memorySaveCore(
			{
				kind: "decision",
				content: "Use vitest",
				summary: "Vitest",
				topicGroup: "testing",
			},
			"/tmp/project",
			db,
		);
		memorySaveCore(
			{
				kind: "decision",
				content: "Use ESLint",
				summary: "ESLint",
				topicGroup: "tooling",
			},
			"/tmp/project",
			db,
		);

		const result = memorySearchCore({ query: "vitest", topicGroup: "testing" }, "/tmp/project", db);
		expect(result.ok).toBe(true);
		expect(result.memories?.length).toBe(1);
		expect(result.memories?.[0].topicGroup).toBe("testing");
	});

	test("memorySearchCore filters by topic", () => {
		memorySaveCore(
			{
				kind: "decision",
				content: "Use vitest for unit",
				summary: "Vitest unit",
				topicGroup: "testing",
				topic: "unit",
			},
			"/tmp/project",
			db,
		);
		memorySaveCore(
			{
				kind: "decision",
				content: "Use playwright for e2e",
				summary: "Playwright e2e",
				topicGroup: "testing",
				topic: "e2e",
			},
			"/tmp/project",
			db,
		);

		const result = memorySearchCore({ topicGroup: "testing", topic: "unit" }, "/tmp/project", db);
		expect(result.ok).toBe(true);
		expect(result.memories?.length).toBe(1);
	});

	test("memorySearchCore returns metadata in results", () => {
		memorySaveCore(
			{
				kind: "decision",
				content: "Use TypeScript",
				summary: "TypeScript",
				topicGroup: "stack",
				topic: "language",
			},
			"/tmp/project",
			db,
		);

		const result = memorySearchCore({}, "/tmp/project", db);
		expect(result.ok).toBe(true);
		expect(result.memories?.length).toBeGreaterThanOrEqual(1);
		const memory = result.memories?.find(
			(mem) => (mem as Record<string, unknown>).topicGroup === "stack",
		);
		expect(memory).toBeDefined();
		expect((memory as Record<string, unknown>).topicGroup).toBe("stack");
		expect((memory as Record<string, unknown>).topic).toBe("language");
		expect((memory as Record<string, unknown>).sourceKind).toBe("curated");
	});
});

describe("buildMemoryContextV2 with topic grouping", () => {
	test("groups memories by topicGroup when enabled", () => {
		const memories: Memory[] = [
			{
				textId: "test-1",
				kind: "decision",
				scope: "user",
				content: "Use vitest",
				summary: "Vitest for testing",
				reasoning: null,
				confidence: 0.9,
				evidenceCount: 1,
				tags: [],
				sourceSession: null,
				status: "active",
				supersedesMemoryId: null,
				accessCount: 0,
				topicGroup: "testing",
				topic: "unit",
				sourceKind: "curated",
				createdAt: "2024-01-01T00:00:00Z",
				lastUpdated: "2024-01-01T00:00:00Z",
				lastAccessed: "2024-01-01T00:00:00Z",
			},
			{
				textId: "test-2",
				kind: "decision",
				scope: "user",
				content: "Use ESLint",
				summary: "ESLint for linting",
				reasoning: null,
				confidence: 0.8,
				evidenceCount: 1,
				tags: [],
				sourceSession: null,
				status: "active",
				supersedesMemoryId: null,
				accessCount: 0,
				topicGroup: "tooling",
				topic: "linting",
				sourceKind: "curated",
				createdAt: "2024-01-01T00:00:00Z",
				lastUpdated: "2024-01-01T00:00:00Z",
				lastAccessed: "2024-01-01T00:00:00Z",
			},
		];

		const result = buildMemoryContextV2({
			projectName: "test-project",
			lastSessionDate: null,
			projectMemories: memories,
			userMemories: [],
			tokenBudget: 2000,
			groupByTopicGroup: true,
		});

		expect(result).toContain("testing");
		expect(result).toContain("tooling");
		expect(result).toContain("Vitest for testing");
		expect(result).toContain("ESLint for linting");
	});

	test("works without topic grouping (backward compat)", () => {
		const memories: Memory[] = [
			{
				textId: "test-1",
				kind: "decision",
				scope: "user",
				content: "Use TypeScript",
				summary: "TypeScript",
				reasoning: null,
				confidence: 0.9,
				evidenceCount: 1,
				tags: [],
				sourceSession: null,
				status: "active",
				supersedesMemoryId: null,
				accessCount: 0,
				topicGroup: null,
				topic: null,
				sourceKind: "curated",
				createdAt: "2024-01-01T00:00:00Z",
				lastUpdated: "2024-01-01T00:00:00Z",
				lastAccessed: "2024-01-01T00:00:00Z",
			},
		];

		const result = buildMemoryContextV2({
			projectName: "test-project",
			lastSessionDate: null,
			projectMemories: memories,
			userMemories: [],
			tokenBudget: 2000,
		});

		expect(result).toContain("TypeScript");
		expect(result).not.toContain("**null**");
	});
});
