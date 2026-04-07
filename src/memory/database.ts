import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runProjectRegistryMigrations } from "../projects/database";
import { getAutopilotDbPath } from "../utils/paths";

let db: Database | null = null;

/**
 * Run all CREATE TABLE / CREATE INDEX / CREATE TRIGGER migrations.
 * Idempotent via IF NOT EXISTS.
 */
export function initMemoryDb(database: Database): void {
	runProjectRegistryMigrations(database);

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

	database.run(`CREATE TABLE IF NOT EXISTS preference_records (
		id TEXT PRIMARY KEY,
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		scope TEXT NOT NULL CHECK(scope IN ('global', 'project')),
		project_id TEXT,
		status TEXT NOT NULL CHECK(status IN ('candidate', 'confirmed', 'rejected')) DEFAULT 'confirmed',
		confidence REAL NOT NULL DEFAULT 0.5,
		source_session TEXT,
		created_at TEXT NOT NULL,
		last_updated TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id),
		UNIQUE(key, scope, project_id)
	)`);

	database.run(`CREATE INDEX IF NOT EXISTS idx_preference_records_scope_updated
		ON preference_records(scope, last_updated DESC, key ASC)`);
	database.run(`CREATE INDEX IF NOT EXISTS idx_preference_records_project_updated
		ON preference_records(project_id, last_updated DESC, key ASC)`);

	database.run(`CREATE TABLE IF NOT EXISTS preference_evidence (
		id TEXT PRIMARY KEY,
		preference_id TEXT NOT NULL,
		session_id TEXT,
		run_id TEXT,
		statement TEXT NOT NULL,
		statement_hash TEXT NOT NULL,
		confidence REAL NOT NULL DEFAULT 0.5,
		confirmed INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		FOREIGN KEY (preference_id) REFERENCES preference_records(id) ON DELETE CASCADE,
		UNIQUE(preference_id, statement_hash)
	)`);

	database.run(`CREATE INDEX IF NOT EXISTS idx_preference_evidence_preference_created
		ON preference_evidence(preference_id, created_at DESC, id DESC)`);

	database.run(`INSERT INTO preference_records (
		id,
		key,
		value,
		scope,
		project_id,
		status,
		confidence,
		source_session,
		created_at,
		last_updated
	)
	SELECT
		p.id,
		p.key,
		p.value,
		'global',
		NULL,
		'confirmed',
		p.confidence,
		p.source_session,
		p.created_at,
		p.last_updated
	FROM preferences p
	WHERE NOT EXISTS (
		SELECT 1
		FROM preference_records pr
		WHERE pr.id = p.id
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

	database.run(`CREATE TABLE IF NOT EXISTS memories (
		id INTEGER PRIMARY KEY,
		text_id TEXT UNIQUE NOT NULL,
		project_id TEXT,
		kind TEXT NOT NULL CHECK(kind IN ('preference','decision','project_fact','mistake','workflow_rule')),
		scope TEXT NOT NULL CHECK(scope IN ('project','user')),
		content TEXT NOT NULL,
		summary TEXT NOT NULL,
		reasoning TEXT,
		confidence REAL NOT NULL DEFAULT 0.8,
		evidence_count INTEGER NOT NULL DEFAULT 1,
		tags TEXT,
		source_session TEXT,
		status TEXT NOT NULL CHECK(status IN ('active','superseded','rejected')) DEFAULT 'active',
		supersedes_memory_id TEXT,
		access_count INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		last_updated TEXT NOT NULL,
		last_accessed TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id)
	)`);

	database.run(`CREATE TABLE IF NOT EXISTS memory_evidence (
		id TEXT PRIMARY KEY,
		memory_id INTEGER NOT NULL,
		session_id TEXT,
		statement TEXT NOT NULL,
		statement_hash TEXT NOT NULL,
		confidence REAL NOT NULL DEFAULT 0.8,
		created_at TEXT NOT NULL,
		FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
		UNIQUE(memory_id, statement_hash)
	)`);

	database.run(`CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
		content, summary, tags,
		content=memories,
		content_rowid=id
	)`);

	database.run(`CREATE TRIGGER IF NOT EXISTS mem_ai AFTER INSERT ON memories BEGIN
		INSERT INTO memories_fts(rowid, content, summary, tags)
		VALUES (new.id, new.content, new.summary, new.tags);
	END`);

	database.run(`CREATE TRIGGER IF NOT EXISTS mem_ad AFTER DELETE ON memories BEGIN
		INSERT INTO memories_fts(memories_fts, rowid, content, summary, tags)
		VALUES('delete', old.id, old.content, old.summary, old.tags);
	END`);

	database.run(`CREATE TRIGGER IF NOT EXISTS mem_au AFTER UPDATE ON memories BEGIN
		INSERT INTO memories_fts(memories_fts, rowid, content, summary, tags)
		VALUES('delete', old.id, old.content, old.summary, old.tags);
		INSERT INTO memories_fts(rowid, content, summary, tags)
		VALUES (new.id, new.content, new.summary, new.tags);
	END`);

	database.run(`CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id, status)`);
	database.run(`CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(kind, status)`);
	database.run(`CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status)`);
	database.run(`CREATE INDEX IF NOT EXISTS idx_memories_text_id ON memories(text_id)`);
	database.run(
		`CREATE INDEX IF NOT EXISTS idx_memory_evidence_memory ON memory_evidence(memory_id)`,
	);
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
			const runtimeDbPath = getAutopilotDbPath();
			mkdirSync(dirname(runtimeDbPath), { recursive: true });
			return runtimeDbPath;
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
