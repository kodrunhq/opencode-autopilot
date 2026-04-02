import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getGlobalConfigDir } from "../utils/paths";
import { DB_FILE, MEMORY_DIR } from "./constants";

let db: Database | null = null;

/**
 * Run all CREATE TABLE / CREATE INDEX / CREATE TRIGGER migrations.
 * Idempotent via IF NOT EXISTS.
 */
export function initMemoryDb(database: Database): void {
	database.run(`CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		path TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL,
		last_updated TEXT NOT NULL
	)`);

	database.run(`CREATE TABLE IF NOT EXISTS observations (
		id INTEGER PRIMARY KEY,
		project_id TEXT,
		session_id TEXT NOT NULL,
		type TEXT NOT NULL CHECK(type IN ('decision','pattern','error','preference','context','tool_usage')),
		content TEXT NOT NULL,
		summary TEXT NOT NULL,
		confidence REAL NOT NULL DEFAULT 0.5,
		access_count INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		last_accessed TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id)
	)`);

	database.run(`CREATE TABLE IF NOT EXISTS preferences (
		id TEXT PRIMARY KEY,
		key TEXT NOT NULL UNIQUE,
		value TEXT NOT NULL,
		confidence REAL NOT NULL DEFAULT 0.5,
		source_session TEXT,
		created_at TEXT NOT NULL,
		last_updated TEXT NOT NULL
	)`);

	database.run(`CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
		content, summary,
		content=observations,
		content_rowid=id
	)`);

	database.run(`CREATE TRIGGER IF NOT EXISTS obs_ai AFTER INSERT ON observations BEGIN
		INSERT INTO observations_fts(rowid, content, summary)
		VALUES (new.id, new.content, new.summary);
	END`);

	database.run(`CREATE TRIGGER IF NOT EXISTS obs_ad AFTER DELETE ON observations BEGIN
		INSERT INTO observations_fts(observations_fts, rowid, content, summary)
		VALUES('delete', old.id, old.content, old.summary);
	END`);

	database.run(`CREATE TRIGGER IF NOT EXISTS obs_au AFTER UPDATE ON observations BEGIN
		INSERT INTO observations_fts(observations_fts, rowid, content, summary)
		VALUES('delete', old.id, old.content, old.summary);
		INSERT INTO observations_fts(rowid, content, summary)
		VALUES (new.id, new.content, new.summary);
	END`);

	database.run(`CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project_id)`);
	database.run(`CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type)`);
}

/**
 * Get or create the singleton memory database.
 * Accepts optional dbPath for testing (e.g. ":memory:").
 */
export function getMemoryDb(dbPath?: string): Database {
	if (db) return db;

	const resolvedPath =
		dbPath ??
		(() => {
			const memoryDir = join(getGlobalConfigDir(), MEMORY_DIR);
			mkdirSync(memoryDir, { recursive: true });
			return join(memoryDir, DB_FILE);
		})();

	db = new Database(resolvedPath);
	db.run("PRAGMA journal_mode=WAL");
	db.run("PRAGMA foreign_keys=ON");
	db.run("PRAGMA busy_timeout=5000");
	initMemoryDb(db);
	return db;
}

/**
 * Close the singleton database and reset.
 */
export function closeMemoryDb(): void {
	if (db) {
		db.close();
		db = null;
	}
}
