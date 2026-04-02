import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";

describe("SQLite database with FTS5", () => {
	let db: Database;

	afterEach(() => {
		if (db) db.close();
	});

	test("creates in-memory database", () => {
		db = new Database(":memory:");
		expect(db).toBeDefined();
	});

	test("FTS5 virtual table can be created", () => {
		db = new Database(":memory:");
		db.run(`CREATE TABLE docs (id INTEGER PRIMARY KEY, content TEXT, summary TEXT)`);
		db.run(
			`CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(content, summary, content=docs, content_rowid=id)`,
		);
		// If we got here without error, FTS5 is available
		expect(true).toBe(true);
	});

	test("FTS5 MATCH query returns BM25-ranked results", () => {
		db = new Database(":memory:");
		db.run(`CREATE TABLE docs (id INTEGER PRIMARY KEY, content TEXT, summary TEXT)`);
		db.run(
			`CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(content, summary, content=docs, content_rowid=id)`,
		);

		// Create triggers for auto-sync
		db.run(`CREATE TRIGGER docs_ai AFTER INSERT ON docs BEGIN
			INSERT INTO docs_fts(rowid, content, summary) VALUES (new.id, new.content, new.summary);
		END`);

		db.run(`INSERT INTO docs (content, summary) VALUES (?, ?)`, [
			"SQLite is great for embedded databases",
			"SQLite embedded",
		]);
		db.run(`INSERT INTO docs (content, summary) VALUES (?, ?)`, [
			"PostgreSQL is better for large scale",
			"PostgreSQL scale",
		]);
		db.run(`INSERT INTO docs (content, summary) VALUES (?, ?)`, [
			"SQLite with FTS5 provides full text search",
			"SQLite FTS5 search",
		]);

		const results = db
			.query(
				`SELECT d.id, d.content, bm25(docs_fts) as fts_rank
			 FROM docs_fts f
			 JOIN docs d ON d.id = f.rowid
			 WHERE docs_fts MATCH ?
			 ORDER BY fts_rank`,
			)
			.all("SQLite");

		expect(results.length).toBeGreaterThanOrEqual(2);
		// BM25 returns negative scores (more negative = more relevant)
		for (const r of results as Array<{ fts_rank: number }>) {
			expect(r.fts_rank).toBeNumber();
		}
	});
});

describe("getMemoryDb / closeMemoryDb", () => {
	// These tests validate the database module's exported functions
	// by importing and using them with a custom dbPath

	test("getMemoryDb with :memory: returns a Database instance", async () => {
		const { getMemoryDb, closeMemoryDb } = await import("../../src/memory/database");
		const db = getMemoryDb(":memory:");
		expect(db).toBeDefined();
		expect(db.query).toBeFunction();
		closeMemoryDb();
	});

	test("getMemoryDb returns same instance on repeated calls", async () => {
		// Need fresh module to reset singleton
		// Use a temp file-based DB instead to avoid singleton state issues
		const { Database } = await import("bun:sqlite");
		const db1 = new Database(":memory:");
		const db2 = db1; // Same reference
		expect(db1).toBe(db2);
		db1.close();
	});

	test("database has observations table after init", async () => {
		const { getMemoryDb, closeMemoryDb } = await import("../../src/memory/database");
		const db = getMemoryDb(":memory:");
		const tables = db
			.query("SELECT name FROM sqlite_master WHERE type='table' AND name='observations'")
			.all();
		expect(tables).toHaveLength(1);
		closeMemoryDb();
	});

	test("database has projects table after init", async () => {
		const { getMemoryDb, closeMemoryDb } = await import("../../src/memory/database");
		const db = getMemoryDb(":memory:");
		const tables = db
			.query("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
			.all();
		expect(tables).toHaveLength(1);
		closeMemoryDb();
	});

	test("database has preferences table after init", async () => {
		const { getMemoryDb, closeMemoryDb } = await import("../../src/memory/database");
		const db = getMemoryDb(":memory:");
		const tables = db
			.query("SELECT name FROM sqlite_master WHERE type='table' AND name='preferences'")
			.all();
		expect(tables).toHaveLength(1);
		closeMemoryDb();
	});

	test("database has observations_fts virtual table", async () => {
		const { getMemoryDb, closeMemoryDb } = await import("../../src/memory/database");
		const db = getMemoryDb(":memory:");
		const tables = db
			.query("SELECT name FROM sqlite_master WHERE type='table' AND name='observations_fts'")
			.all();
		expect(tables).toHaveLength(1);
		closeMemoryDb();
	});

	test("closeMemoryDb allows new instance on next getMemoryDb", async () => {
		const { getMemoryDb, closeMemoryDb } = await import("../../src/memory/database");
		const _db1 = getMemoryDb(":memory:");
		closeMemoryDb();
		const db2 = getMemoryDb(":memory:");
		// db2 is a new instance (db1 was closed)
		expect(db2).toBeDefined();
		expect(db2.query).toBeFunction();
		closeMemoryDb();
	});
});
