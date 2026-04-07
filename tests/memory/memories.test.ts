import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import {
	forgetMemory,
	getActiveMemories,
	getMemoryById,
	migratePreferencesToMemories,
	saveMemory,
	searchMemories,
} from "../../src/memory/memories";
import { upsertPreferenceRecord } from "../../src/memory/preferences";
import { upsertProject } from "../../src/memory/projects";

describe("memories repository", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("saveMemory creates a new memory, stores tags JSON, and records evidence", () => {
		upsertProject(
			{
				id: "proj-1",
				path: "/tmp/project-one",
				name: "project-one",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);

		const memory = saveMemory(
			{
				kind: "decision",
				content: "Use Bun test for repository coverage.",
				summary: "Use Bun test",
				tags: ["testing", "bun"],
				projectId: "proj-1",
				sourceSession: "sess-1",
			},
			db,
		);

		expect(memory.id).toBeNumber();
		expect(memory.projectId).toBe("proj-1");
		expect(memory.tags).toEqual(["testing", "bun"]);
		expect(memory.evidenceCount).toBe(1);

		const storedRow = db
			.query("SELECT tags FROM memories WHERE text_id = ?")
			.get(memory.textId) as { tags: string } | null;
		expect(storedRow?.tags).toBe('["testing","bun"]');

		const evidenceRows = db
			.query("SELECT statement, statement_hash FROM memory_evidence WHERE memory_id = ?")
			.all(memory.id as number) as Array<{ statement: string; statement_hash: string }>;
		expect(evidenceRows).toHaveLength(1);
		expect(evidenceRows[0]?.statement).toBe("Use Bun test for repository coverage.");
		expect(evidenceRows[0]?.statement_hash).toHaveLength(64);
	});

	test("saveMemory deduplicates similar content and adds evidence to the existing memory", () => {
		upsertProject(
			{
				id: "proj-1",
				path: "/tmp/project-one",
				name: "project-one",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);

		const first = saveMemory(
			{
				kind: "workflow_rule",
				content: "Run lint and tests before opening a pull request.",
				summary: "Verify before PR",
				projectId: "proj-1",
				sourceSession: "sess-1",
			},
			db,
		);

		const second = saveMemory(
			{
				kind: "workflow_rule",
				content: "Run lint and tests before opening any pull request.",
				summary: "Verify before PR again",
				projectId: "proj-1",
				sourceSession: "sess-2",
				confidence: 0.95,
			},
			db,
		);

		expect(second.textId).toBe(first.textId);
		expect(second.evidenceCount).toBe(2);
		expect(second.confidence).toBe(0.95);

		const memoryCount = (
			db.query("SELECT COUNT(*) AS count FROM memories WHERE project_id = ?").get("proj-1") as {
				count: number;
			}
		).count;
		expect(memoryCount).toBe(1);

		const evidenceCount = (
			db
				.query(
					"SELECT COUNT(*) AS count FROM memory_evidence WHERE memory_id = (SELECT id FROM memories WHERE text_id = ?)",
				)
				.get(first.textId) as { count: number }
		).count;
		expect(evidenceCount).toBe(2);
	});

	test("searchMemories finds FTS matches, respects project scope, and returns empty when missing", () => {
		upsertProject(
			{
				id: "proj-1",
				path: "/tmp/project-one",
				name: "project-one",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);

		saveMemory(
			{
				kind: "project_fact",
				content: "The deployment pipeline uses Bun and SQLite caching.",
				summary: "Bun pipeline",
				projectId: "proj-1",
			},
			db,
		);
		saveMemory(
			{
				kind: "project_fact",
				content: "My personal setup uses Bun shell aliases.",
				summary: "User Bun setup",
				scope: "user",
			},
			db,
		);

		const projectResults = searchMemories("Bun", "proj-1", 10, db);
		expect(projectResults).toHaveLength(1);
		expect(projectResults[0]?.projectId).toBe("proj-1");
		expect(projectResults[0]?.ftsRank).toBeNumber();

		const userResults = searchMemories("Bun", null, 10, db);
		expect(userResults).toHaveLength(1);
		expect(userResults[0]?.projectId).toBeNull();

		expect(searchMemories("nonexistent token", "proj-1", 10, db)).toEqual([]);
	});

	test("getActiveMemories returns only active memories for a project ordered by last_updated desc", () => {
		upsertProject(
			{
				id: "proj-1",
				path: "/tmp/project-one",
				name: "project-one",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);
		upsertProject(
			{
				id: "proj-2",
				path: "/tmp/project-two",
				name: "project-two",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);

		const first = saveMemory(
			{
				kind: "decision",
				content: "Use strict TypeScript settings.",
				summary: "TS strict",
				projectId: "proj-1",
			},
			db,
		);
		const second = saveMemory(
			{
				kind: "decision",
				content: "Keep CI checks deterministic.",
				summary: "Deterministic CI",
				projectId: "proj-1",
			},
			db,
		);
		saveMemory(
			{
				kind: "decision",
				content: "Use a different project memory.",
				summary: "Other project",
				projectId: "proj-2",
			},
			db,
		);

		db.run("UPDATE memories SET last_updated = ? WHERE text_id = ?", [
			"2026-01-01T00:00:00Z",
			first.textId,
		]);
		db.run("UPDATE memories SET last_updated = ? WHERE text_id = ?", [
			"2026-01-02T00:00:00Z",
			second.textId,
		]);
		db.run("UPDATE memories SET status = 'rejected' WHERE text_id = ?", [first.textId]);

		const memories = getActiveMemories("proj-1", 10, db);
		expect(memories).toHaveLength(1);
		expect(memories[0]?.textId).toBe(second.textId);
	});

	test("forgetMemory soft-deletes active memories and removes them from active queries", () => {
		const memory = saveMemory(
			{
				kind: "mistake",
				content: "Do not skip repository diagnostics.",
				summary: "Keep diagnostics",
				scope: "user",
			},
			db,
		);

		expect(forgetMemory(memory.textId, db)).toBe(true);
		expect(forgetMemory("missing-memory", db)).toBe(false);
		expect(getActiveMemories(null, 10, db)).toEqual([]);
		expect(getMemoryById(memory.textId, db)?.status).toBe("rejected");
	});

	test("getMemoryById returns the matching memory and null for missing ids", () => {
		const memory = saveMemory(
			{
				kind: "preference",
				content: "editor: helix",
				summary: "Helix editor",
				scope: "user",
			},
			db,
		);

		const found = getMemoryById(memory.textId, db);
		expect(found?.textId).toBe(memory.textId);
		expect(found?.content).toBe("editor: helix");
		expect(getMemoryById("missing", db)).toBeNull();
	});

	test("migratePreferencesToMemories migrates confirmed preferences and skips duplicates", () => {
		upsertProject(
			{
				id: "proj-1",
				path: "/tmp/project-one",
				name: "project-one",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);

		upsertPreferenceRecord(
			{
				key: "editor.theme",
				value: "dark",
				scope: "global",
				status: "confirmed",
				sourceSession: "sess-1",
				createdAt: "2026-01-01T00:00:00Z",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);
		upsertPreferenceRecord(
			{
				key: "testing.framework",
				value: "bun:test",
				scope: "project",
				projectId: "proj-1",
				status: "confirmed",
				sourceSession: "sess-2",
				createdAt: "2026-01-01T00:00:00Z",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);
		upsertPreferenceRecord(
			{
				key: "package.manager",
				value: "npm",
				scope: "global",
				status: "candidate",
				createdAt: "2026-01-01T00:00:00Z",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);

		saveMemory(
			{
				kind: "preference",
				content: "editor.theme: dark",
				summary: "dark",
				scope: "user",
			},
			db,
		);

		const result = migratePreferencesToMemories(db);
		expect(result).toEqual({ migrated: 1, skipped: 1 });

		const userMemories = getActiveMemories(null, 10, db);
		expect(userMemories).toHaveLength(1);
		expect(userMemories[0]?.scope).toBe("user");

		const projectMemories = getActiveMemories("proj-1", 10, db);
		expect(projectMemories).toHaveLength(1);
		expect(projectMemories[0]?.scope).toBe("project");
		expect(projectMemories[0]?.content).toBe("testing.framework: bun:test");
	});
});
