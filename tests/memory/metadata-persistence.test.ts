import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { getActiveMemories, saveMemory, searchMemories } from "../../src/memory/memories";

describe("memory metadata persistence", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("saveMemory stores topicGroup and topic", () => {
		const memory = saveMemory(
			{
				kind: "decision",
				content: "Use PostgreSQL for the database",
				summary: "Use PostgreSQL",
				topicGroup: "architecture",
				topic: "database",
			},
			db,
		);

		expect(memory.topicGroup).toBe("architecture");
		expect(memory.topic).toBe("database");
		expect(memory.sourceKind).toBe("curated");
	});

	test("saveMemory defaults sourceKind to curated", () => {
		const memory = saveMemory(
			{
				kind: "preference",
				content: "User prefers dark mode",
				summary: "Dark mode preference",
			},
			db,
		);

		expect(memory.sourceKind).toBe("curated");
	});

	test("saveMemory stores explicit sourceKind", () => {
		const memory = saveMemory(
			{
				kind: "project_fact",
				content: "CI uses GitHub Actions",
				summary: "GitHub Actions CI",
				sourceKind: "raw_attachment",
			},
			db,
		);

		expect(memory.sourceKind).toBe("raw_attachment");
	});

	test("saveMemory with null topicGroup and topic", () => {
		const memory = saveMemory(
			{
				kind: "preference",
				content: "Use tabs",
				summary: "Tabs preference",
				topicGroup: null,
				topic: null,
			},
			db,
		);

		expect(memory.topicGroup).toBeNull();
		expect(memory.topic).toBeNull();
	});

	test("dedup merge preserves existing metadata", () => {
		saveMemory(
			{
				kind: "decision",
				content: "Use React for the frontend framework",
				summary: "React for frontend",
				topicGroup: "architecture",
				topic: "frontend",
			},
			db,
		);

		const merged = saveMemory(
			{
				kind: "decision",
				content: "Use React for the frontend framework on all pages",
				summary: "React frontend",
			},
			db,
		);

		expect(merged.topicGroup).toBe("architecture");
		expect(merged.topic).toBe("frontend");
	});

	test("searchMemories filters by topicGroup", () => {
		saveMemory(
			{
				kind: "decision",
				content: "Use vitest for testing",
				summary: "Vitest testing",
				topicGroup: "testing",
				topic: "framework",
			},
			db,
		);

		saveMemory(
			{
				kind: "decision",
				content: "Use ESLint for linting",
				summary: "ESLint linting",
				topicGroup: "tooling",
			},
			db,
		);

		const results = searchMemories("vitest", null, 10, db, { topicGroup: "testing" });
		expect(results.length).toBe(1);
		expect(results[0]?.topicGroup).toBe("testing");
	});

	test("searchMemories filters by topicGroup and topic", () => {
		saveMemory(
			{
				kind: "decision",
				content: "Use vitest for unit tests",
				summary: "Vitest unit tests",
				topicGroup: "testing",
				topic: "unit",
			},
			db,
		);

		saveMemory(
			{
				kind: "decision",
				content: "Use playwright for e2e tests",
				summary: "Playwright e2e",
				topicGroup: "testing",
				topic: "e2e",
			},
			db,
		);

		const results = searchMemories("tests", null, 10, db, {
			topicGroup: "testing",
			topic: "unit",
		});
		expect(results.length).toBe(1);
		expect(results[0]?.topic).toBe("unit");
	});

	test("searchMemories filters by sourceKind", () => {
		saveMemory(
			{
				kind: "project_fact",
				content: "Build uses Bun runtime for execution",
				summary: "Bun build runtime",
				sourceKind: "curated",
			},
			db,
		);

		saveMemory(
			{
				kind: "project_fact",
				content: "Raw log output from CI build",
				summary: "CI build log",
				sourceKind: "raw_attachment",
			},
			db,
		);

		const curatedResults = searchMemories("build", null, 10, db, { sourceKind: "curated" });
		expect(curatedResults.length).toBe(1);
		expect(curatedResults[0]?.sourceKind).toBe("curated");

		const rawResults = searchMemories("build", null, 10, db, { sourceKind: "raw_attachment" });
		expect(rawResults.length).toBe(1);
		expect(rawResults[0]?.sourceKind).toBe("raw_attachment");
	});

	test("getActiveMemories filters by sourceKind", () => {
		saveMemory(
			{
				kind: "project_fact",
				content: "PostgreSQL for primary store",
				summary: "PostgreSQL primary",
				sourceKind: "curated",
			},
			db,
		);

		saveMemory(
			{
				kind: "project_fact",
				content: "PostgreSQL raw schema dump attached",
				summary: "Schema dump",
				sourceKind: "raw_attachment",
			},
			db,
		);

		const curated = getActiveMemories(null, 10, db, { sourceKind: "curated" });
		expect(curated.length).toBe(1);
		expect(curated[0]?.sourceKind).toBe("curated");

		const raw = getActiveMemories(null, 10, db, { sourceKind: "raw_attachment" });
		expect(raw.length).toBe(1);
		expect(raw[0]?.sourceKind).toBe("raw_attachment");
	});

	test("getActiveMemories filters by topicGroup", () => {
		saveMemory(
			{
				kind: "project_fact",
				content: "Project uses TypeScript",
				summary: "TypeScript",
				topicGroup: "stack",
			},
			db,
		);

		saveMemory(
			{
				kind: "project_fact",
				content: "Project uses React",
				summary: "React",
				topicGroup: "stack",
				topic: "frontend",
			},
			db,
		);

		saveMemory(
			{
				kind: "preference",
				content: "Dark mode preferred",
				summary: "Dark mode",
				topicGroup: "ui",
			},
			db,
		);

		const stackMemories = getActiveMemories(null, 10, db, { topicGroup: "stack" });
		expect(stackMemories.length).toBe(2);
		expect(stackMemories.every((memory) => memory.topicGroup === "stack")).toBe(true);
	});
});
