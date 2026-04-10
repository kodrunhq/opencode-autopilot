import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";

describe("memory metadata migration", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
	});

	afterEach(() => {
		db.close();
	});

	test("fresh database has topic_group, topic, and source_kind columns", () => {
		initMemoryDb(db);
		const columns = db.query("PRAGMA table_info(memories)").all() as Array<{ name: string }>;
		const names = columns.map((column) => column.name);
		expect(names).toContain("topic_group");
		expect(names).toContain("topic");
		expect(names).toContain("source_kind");
	});

	test("fresh database has metadata indexes", () => {
		initMemoryDb(db);
		const indexes = db
			.query(
				"SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_memories_topic%'",
			)
			.all() as Array<{ name: string }>;
		const names = indexes.map((index) => index.name);
		expect(names).toContain("idx_memories_topic_group");
		expect(names).toContain("idx_memories_topic");
	});

	test("idempotent migration does not fail on re-run", () => {
		initMemoryDb(db);
		expect(() => initMemoryDb(db)).not.toThrow();
	});

	test("legacy memories table without new columns gets them added", () => {
		db.run(`CREATE TABLE IF NOT EXISTS memories (
			id INTEGER PRIMARY KEY,
			text_id TEXT UNIQUE NOT NULL,
			project_id TEXT,
			kind TEXT NOT NULL,
			scope TEXT NOT NULL,
			content TEXT NOT NULL,
			summary TEXT NOT NULL,
			reasoning TEXT,
			confidence REAL NOT NULL DEFAULT 0.8,
			evidence_count INTEGER NOT NULL DEFAULT 1,
			tags TEXT,
			source_session TEXT,
			status TEXT NOT NULL DEFAULT 'active',
			supersedes_memory_id TEXT,
			access_count INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			last_updated TEXT NOT NULL,
			last_accessed TEXT NOT NULL
		)`);

		db.run(
			`INSERT INTO memories (
				text_id,
				kind,
				scope,
				content,
				summary,
				created_at,
				last_updated,
				last_accessed
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"test-id",
				"preference",
				"user",
				"test content",
				"test summary",
				"2024-01-01T00:00:00Z",
				"2024-01-01T00:00:00Z",
				"2024-01-01T00:00:00Z",
			],
		);

		initMemoryDb(db);

		const row = db.query("SELECT * FROM memories WHERE text_id = ?").get("test-id") as Record<
			string,
			unknown
		>;
		expect(row).toBeDefined();
		expect(row.topic_group).toBeNull();
		expect(row.topic).toBeNull();
		expect(row.source_kind).toBe("curated");
	});

	test("source_kind defaults to curated for new inserts", () => {
		initMemoryDb(db);
		db.run(
			`INSERT INTO memories (
				text_id,
				kind,
				scope,
				content,
				summary,
				created_at,
				last_updated,
				last_accessed
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				"test-id-2",
				"decision",
				"user",
				"decided X",
				"X",
				"2024-01-01T00:00:00Z",
				"2024-01-01T00:00:00Z",
				"2024-01-01T00:00:00Z",
			],
		);
		const row = db.query("SELECT source_kind FROM memories WHERE text_id = ?").get("test-id-2") as {
			source_kind: string;
		};
		expect(row.source_kind).toBe("curated");
	});
});
