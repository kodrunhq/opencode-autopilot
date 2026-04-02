import type { Database } from "bun:sqlite";
import { OBSERVATION_TYPES } from "./constants";
import { getMemoryDb } from "./database";
import { observationSchema, preferenceSchema, projectSchema } from "./schemas";
import type { Observation, ObservationType, Preference, Project } from "./types";

/** Resolve optional db parameter to singleton fallback. */
function resolveDb(db?: Database): Database {
	return db ?? getMemoryDb();
}

/** Validate observation type at runtime. */
function parseObservationType(value: unknown): ObservationType {
	if (typeof value === "string" && (OBSERVATION_TYPES as readonly string[]).includes(value)) {
		return value as ObservationType;
	}
	return "context"; // safe fallback for corrupt/unknown types
}

/** Map a snake_case DB row to camelCase Observation. */
function rowToObservation(row: Record<string, unknown>): Observation {
	return {
		id: row.id as number,
		projectId: (row.project_id as string) ?? null,
		sessionId: row.session_id as string,
		type: parseObservationType(row.type),
		content: row.content as string,
		summary: row.summary as string,
		confidence: row.confidence as number,
		accessCount: row.access_count as number,
		createdAt: row.created_at as string,
		lastAccessed: row.last_accessed as string,
	};
}

/** Map a snake_case DB row to camelCase Project. */
function rowToProject(row: Record<string, unknown>): Project {
	return {
		id: row.id as string,
		path: row.path as string,
		name: row.name as string,
		lastUpdated: row.last_updated as string,
	};
}

/** Map a snake_case DB row to camelCase Preference. */
function rowToPreference(row: Record<string, unknown>): Preference {
	return {
		id: row.id as string,
		key: row.key as string,
		value: row.value as string,
		confidence: row.confidence as number,
		sourceSession: (row.source_session as string) ?? null,
		createdAt: row.created_at as string,
		lastUpdated: row.last_updated as string,
	};
}

/**
 * Insert an observation. Validates via Zod before writing.
 * Returns the observation with the generated id.
 */
export function insertObservation(obs: Omit<Observation, "id">, db?: Database): Observation {
	const validated = observationSchema.omit({ id: true }).parse(obs);
	const d = resolveDb(db);

	d.run(
		`INSERT INTO observations (project_id, session_id, type, content, summary, confidence, access_count, created_at, last_accessed)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			validated.projectId,
			validated.sessionId,
			validated.type,
			validated.content,
			validated.summary,
			validated.confidence,
			validated.accessCount,
			validated.createdAt,
			validated.lastAccessed,
		],
	);

	const row = d.query("SELECT last_insert_rowid() as id").get() as { id: number };
	return { ...validated, id: row.id };
}

/**
 * Search observations using FTS5 MATCH with BM25 ranking.
 * Filters by projectId (null for user-level observations).
 */
export function searchObservations(
	query: string,
	projectId: string | null,
	limit = 20,
	db?: Database,
): Array<Observation & { ftsRank: number }> {
	const d = resolveDb(db);

	const projectFilter = projectId === null ? "AND o.project_id IS NULL" : "AND o.project_id = ?";

	// Sanitize FTS5 query — wrap in double-quotes to prevent operator injection
	const safeFtsQuery = `"${query.replace(/"/g, '""')}"`;
	const params: Array<string | number> =
		projectId === null ? [safeFtsQuery, limit] : [safeFtsQuery, projectId, limit];

	const rows = d
		.query(
			`SELECT o.*, bm25(observations_fts) as fts_rank
			 FROM observations_fts f
			 JOIN observations o ON o.id = f.rowid
			 WHERE observations_fts MATCH ?
			   ${projectFilter}
			 ORDER BY fts_rank
			 LIMIT ?`,
		)
		.all(...params) as Array<Record<string, unknown>>;

	return rows.map((row) => ({
		...rowToObservation(row),
		ftsRank: row.fts_rank as number,
	}));
}

/**
 * Create or replace a project record.
 */
export function upsertProject(project: Project, db?: Database): void {
	const validated = projectSchema.parse(project);
	const d = resolveDb(db);
	d.run(`INSERT OR REPLACE INTO projects (id, path, name, last_updated) VALUES (?, ?, ?, ?)`, [
		validated.id,
		validated.path,
		validated.name,
		validated.lastUpdated,
	]);
}

/**
 * Get a project by its filesystem path. Returns null if not found.
 */
export function getProjectByPath(path: string, db?: Database): Project | null {
	const d = resolveDb(db);
	const row = d.query("SELECT * FROM projects WHERE path = ?").get(path) as Record<
		string,
		unknown
	> | null;
	return row ? rowToProject(row) : null;
}

/**
 * Get observations filtered by project_id, ordered by created_at DESC.
 */
export function getObservationsByProject(
	projectId: string | null,
	limit = 50,
	db?: Database,
): readonly Observation[] {
	const d = resolveDb(db);

	const whereClause = projectId === null ? "WHERE project_id IS NULL" : "WHERE project_id = ?";
	const params: Array<string | number> = projectId === null ? [limit] : [projectId, limit];

	const rows = d
		.query(`SELECT * FROM observations ${whereClause} ORDER BY created_at DESC LIMIT ?`)
		.all(...params) as Array<Record<string, unknown>>;

	return rows.map(rowToObservation);
}

/**
 * Create or replace a preference by its id.
 */
export function upsertPreference(pref: Preference, db?: Database): void {
	const validated = preferenceSchema.parse(pref);
	const d = resolveDb(db);
	d.run(
		`INSERT OR REPLACE INTO preferences (id, key, value, confidence, source_session, created_at, last_updated)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			validated.id,
			validated.key,
			validated.value,
			validated.confidence,
			validated.sourceSession,
			validated.createdAt,
			validated.lastUpdated,
		],
	);
}

/**
 * Get all preferences.
 */
export function getAllPreferences(db?: Database): readonly Preference[] {
	const d = resolveDb(db);
	const rows = d.query("SELECT * FROM preferences").all() as Array<Record<string, unknown>>;
	return rows.map(rowToPreference);
}

/**
 * Delete an observation by id.
 */
export function deleteObservation(id: number, db?: Database): void {
	const d = resolveDb(db);
	d.run("DELETE FROM observations WHERE id = ?", [id]);
}

/**
 * Increment access_count and update last_accessed for an observation.
 */
export function updateAccessCount(id: number, db?: Database): void {
	const d = resolveDb(db);
	d.run("UPDATE observations SET access_count = access_count + 1, last_accessed = ? WHERE id = ?", [
		new Date().toISOString(),
		id,
	]);
}
