import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { saveMemory } from "../../src/memory/memories";
import { memorySearchCore, ocMemorySearch } from "../../src/tools/memory-search";

describe("memorySearchCore", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("returns empty results when no memories exist", () => {
		const result = memorySearchCore({}, "/tmp/project", db);

		expect(result.ok).toBe(true);
		expect(result.memories).toEqual([]);
	});

	test("lists all active user memories without query", () => {
		saveMemory(
			{
				kind: "preference",
				content: "Always use strict TypeScript mode",
				summary: "Strict TS mode",
				scope: "user",
			},
			db,
		);
		saveMemory(
			{
				kind: "decision",
				content: "Use Bun for testing instead of Jest",
				summary: "Bun over Jest",
				scope: "user",
			},
			db,
		);

		const result = memorySearchCore({ scope: "user" }, "/tmp/project", db);

		expect(result.ok).toBe(true);
		expect(result.memories?.length).toBe(2);
	});

	test("searches memories by FTS query", () => {
		saveMemory(
			{
				kind: "preference",
				content: "Always use strict TypeScript mode",
				summary: "Strict TS mode",
				scope: "user",
			},
			db,
		);
		saveMemory(
			{
				kind: "decision",
				content: "Use PostgreSQL for the database layer",
				summary: "PostgreSQL for DB",
				scope: "user",
			},
			db,
		);

		const result = memorySearchCore({ query: "TypeScript", scope: "user" }, "/tmp/project", db);

		expect(result.ok).toBe(true);
		expect(result.memories?.length).toBeGreaterThan(0);
		expect(result.memories?.[0].content).toContain("TypeScript");
	});

	test("filters by kind", () => {
		saveMemory(
			{
				kind: "preference",
				content: "Always use strict TypeScript mode",
				summary: "Strict TS mode",
				scope: "user",
			},
			db,
		);
		saveMemory(
			{
				kind: "mistake",
				content: "Do not commit .env files to version control",
				summary: "Never commit .env",
				scope: "user",
			},
			db,
		);

		const result = memorySearchCore({ kind: "mistake", scope: "user" }, "/tmp/project", db);

		expect(result.ok).toBe(true);
		expect(result.memories?.length).toBe(1);
		expect(result.memories?.[0].kind).toBe("mistake");
	});

	test("respects limit parameter", () => {
		for (let i = 0; i < 5; i++) {
			saveMemory(
				{
					kind: "preference",
					content: `Preference number ${i} about some unique topic ${i}`,
					summary: `Preference ${i}`,
					scope: "user",
				},
				db,
			);
		}

		const result = memorySearchCore({ limit: 3, scope: "user" }, "/tmp/project", db);

		expect(result.ok).toBe(true);
		expect(result.memories?.length).toBeLessThanOrEqual(3);
	});
});

describe("ocMemorySearch tool", () => {
	test("is defined", () => {
		expect(ocMemorySearch).toBeDefined();
	});
});
