import type { Database } from "bun:sqlite";

export const PROJECT_REGISTRY_STATEMENTS: readonly string[] = Object.freeze([
	`CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		path TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL,
		first_seen_at TEXT NOT NULL,
		last_updated TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS project_paths (
		project_id TEXT NOT NULL,
		path TEXT NOT NULL,
		first_seen_at TEXT NOT NULL,
		last_updated TEXT NOT NULL,
		is_current INTEGER NOT NULL CHECK(is_current IN (0, 1)),
		PRIMARY KEY (project_id, path),
		UNIQUE(path),
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	)`,
	`CREATE INDEX IF NOT EXISTS idx_project_paths_project ON project_paths(project_id, is_current DESC, path)`,
	`CREATE TABLE IF NOT EXISTS project_git_fingerprints (
		project_id TEXT NOT NULL,
		normalized_remote_url TEXT NOT NULL,
		default_branch TEXT,
		first_seen_at TEXT NOT NULL,
		last_updated TEXT NOT NULL,
		PRIMARY KEY (project_id, normalized_remote_url),
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	)`,
	`CREATE INDEX IF NOT EXISTS idx_project_git_remote ON project_git_fingerprints(normalized_remote_url, last_updated DESC)`,
]);

export function runProjectRegistryMigrations(database: Database): void {
	for (const statement of PROJECT_REGISTRY_STATEMENTS) {
		database.run(statement);
	}

	const projectsInfo = database.query("PRAGMA table_info(projects)").all() as Array<{
		name?: string;
	}>;
	const hasFirstSeenAt = projectsInfo.some((column) => column.name === "first_seen_at");
	if (!hasFirstSeenAt) {
		database.run("ALTER TABLE projects ADD COLUMN first_seen_at TEXT");
		database.run("UPDATE projects SET first_seen_at = COALESCE(first_seen_at, last_updated)");
	}
}
