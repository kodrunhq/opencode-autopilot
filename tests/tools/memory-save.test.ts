import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { memorySaveCore, ocMemorySave } from "../../src/tools/memory-save";

describe("memorySaveCore", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("saves a new user-scoped preference memory", () => {
		const result = memorySaveCore(
			{
				kind: "preference",
				content: "User prefers tabs over spaces for indentation",
				summary: "Tabs over spaces",
				scope: "user",
			},
			"/tmp/project",
			db,
		);

		expect(result.ok).toBe(true);
		expect(result.memory).toBeDefined();
		expect(result.memory?.kind).toBe("preference");
		expect(result.memory?.scope).toBe("user");
		expect(result.memory?.summary).toBe("Tabs over spaces");
		expect(result.memory?.status).toBe("active");
	});

	test("saves a decision memory with reasoning and tags", () => {
		const result = memorySaveCore(
			{
				kind: "decision",
				content: "We chose PostgreSQL over MySQL for the new service",
				summary: "Use PostgreSQL for new service",
				reasoning: "Better JSON support and extensibility",
				tags: ["database", "architecture"],
			},
			"/tmp/project",
			db,
		);

		expect(result.ok).toBe(true);
		expect(result.memory?.kind).toBe("decision");
	});

	test("deduplicates similar memories", () => {
		memorySaveCore(
			{
				kind: "preference",
				content: "User prefers tabs over spaces for indentation in all files",
				summary: "Tabs over spaces",
				scope: "user",
			},
			"/tmp/project",
			db,
		);

		const result = memorySaveCore(
			{
				kind: "preference",
				content: "User prefers tabs over spaces for indentation in all source files",
				summary: "Tabs over spaces",
				scope: "user",
			},
			"/tmp/project",
			db,
		);

		expect(result.ok).toBe(true);
		expect(result.memory?.evidenceCount).toBeGreaterThan(1);
	});

	test("returns error for project scope without known project", () => {
		const result = memorySaveCore(
			{
				kind: "project_fact",
				content: "This project uses Bun runtime",
				summary: "Uses Bun",
				scope: "project",
			},
			"/nonexistent/path",
			db,
		);

		expect(result.ok).toBe(false);
		expect(result.error).toContain("project");
	});

	test("saves a mistake memory", () => {
		const result = memorySaveCore(
			{
				kind: "mistake",
				content: "Never use rm -rf without checking the path variable first",
				summary: "Check path before rm -rf",
				scope: "user",
			},
			"/tmp/project",
			db,
		);

		expect(result.ok).toBe(true);
		expect(result.memory?.kind).toBe("mistake");
	});

	test("passes sessionId through as sourceSession", () => {
		const result = memorySaveCore(
			{
				kind: "preference",
				content: "User prefers dark mode in all editors",
				summary: "Dark mode preference",
				scope: "user",
			},
			"/tmp/project",
			db,
			"sess-test-123",
		);

		expect(result.ok).toBe(true);

		const row = db
			.query("SELECT source_session FROM memories WHERE text_id = ?")
			.get(result.memory?.textId as string) as { source_session: string | null } | null;
		expect(row?.source_session).toBe("sess-test-123");
	});

	test("sourceSession defaults to null when sessionId not provided", () => {
		const result = memorySaveCore(
			{
				kind: "preference",
				content: "User prefers light mode in all editors",
				summary: "Light mode preference",
				scope: "user",
			},
			"/tmp/project",
			db,
		);

		expect(result.ok).toBe(true);

		const row = db
			.query("SELECT source_session FROM memories WHERE text_id = ?")
			.get(result.memory?.textId as string) as { source_session: string | null } | null;
		expect(row?.source_session).toBeNull();
	});
});

describe("ocMemorySave tool", () => {
	test("is defined", () => {
		expect(ocMemorySave).toBeDefined();
	});
});
