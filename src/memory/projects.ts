/**
 * Project repository operations.
 *
 * Handles project upsert and path resolution.
 * Extracted from repository.ts for better module organization.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { getMemoryDb } from "./database";
import { projectSchema } from "./schemas";
import type { Project } from "./types";

/** Resolve optional db parameter to singleton fallback. */
function resolveDb(db?: Database): Database {
	return db ?? getMemoryDb();
}

/** Map a snake_case DB row to camelCase Project. */
function rowToProject(row: Record<string, unknown>): Project {
	return {
		id: row.id as string,
		path: row.path as string,
		name: row.name as string,
		firstSeenAt: ((row.first_seen_at as string) ?? (row.last_updated as string)) as string,
		lastUpdated: row.last_updated as string,
	};
}

/**
 * Create or replace a project record.
 */
export function upsertProject(project: Project, db?: Database): void {
	const validated = projectSchema.parse(project);
	const d = resolveDb(db);
	const firstSeenAt = validated.firstSeenAt ?? validated.lastUpdated;
	d.run(
		`INSERT INTO projects (id, path, name, first_seen_at, last_updated)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
			path = excluded.path,
			name = excluded.name,
			first_seen_at = COALESCE(projects.first_seen_at, excluded.first_seen_at),
			last_updated = excluded.last_updated`,
		[validated.id, validated.path, validated.name, firstSeenAt, validated.lastUpdated],
	);
	d.run("UPDATE project_paths SET is_current = 0, last_updated = ? WHERE project_id = ?", [
		validated.lastUpdated,
		validated.id,
	]);
	d.run(
		`INSERT INTO project_paths (project_id, path, first_seen_at, last_updated, is_current)
		 VALUES (?, ?, ?, ?, 1)
		 ON CONFLICT(project_id, path) DO UPDATE SET
			last_updated = excluded.last_updated,
			is_current = 1`,
		[validated.id, validated.path, firstSeenAt, validated.lastUpdated],
	);
}

/**
 * Get a project by its filesystem path. Returns null if not found.
 */
export function getProjectByPath(path: string, db?: Database): Project | null {
	const d = resolveDb(db);
	const row = d
		.query(
			`SELECT p.*
			 FROM projects p
			 WHERE p.path = ?
			UNION ALL
			SELECT p.*
			 FROM project_paths pp
			 JOIN projects p ON p.id = pp.project_id
			 WHERE pp.path = ?
			   AND NOT EXISTS (SELECT 1 FROM projects p2 WHERE p2.path = ?)
			 ORDER BY last_updated DESC
			 LIMIT 1`,
		)
		.get(path, path, path) as Record<string, unknown> | null;
	return row ? rowToProject(row) : null;
}
