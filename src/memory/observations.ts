/**
 * Observation repository operations.
 *
 * Handles observation CRUD, search, and access tracking.
 * Extracted from repository.ts for better module organization.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { withTransaction } from "../kernel/transaction";
import { OBSERVATION_TYPES } from "./constants";
import { getMemoryDb } from "./database";
import { observationSchema } from "./schemas";
import type { Observation, ObservationType } from "./types";

/** Resolve optional db parameter to singleton fallback. */
function resolveDb(db?: Database): Database {
	return db ?? getMemoryDb();
}

/** Validate observation type at runtime. */
function parseObservationType(value: unknown): ObservationType {
	if (typeof value === "string" && (OBSERVATION_TYPES as readonly string[]).includes(value)) {
		return value as ObservationType;
	}
	return "context";
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

/**
 * Insert an observation. Validates via Zod before writing.
 * Returns the observation with the generated id.
 */
export function insertObservation(obs: Omit<Observation, "id">, db?: Database): Observation {
	const validated = observationSchema.omit({ id: true }).parse(obs);
	const d = resolveDb(db);

	return withTransaction(d, () => {
		const row = d
			.query<
				{ id: number },
				[string | null, string, ObservationType, string, string, number, number, string, string]
			>(
				`INSERT INTO observations (project_id, session_id, type, content, summary, confidence, access_count, created_at, last_accessed)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
			)
			.get(
				validated.projectId,
				validated.sessionId,
				validated.type,
				validated.content,
				validated.summary,
				validated.confidence,
				validated.accessCount,
				validated.createdAt,
				validated.lastAccessed,
			);

		if (!row) {
			throw new Error("Failed to insert observation");
		}

		return { ...validated, id: row.id };
	});
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
 * Get recent failure observations for a project.
 */
export function getRecentFailureObservations(
	projectId: string,
	limit = 5,
	db?: Database,
): readonly Observation[] {
	const d = resolveDb(db);
	const rows = d
		.query(
			`SELECT *
			 FROM observations
			 WHERE project_id = ?
			   AND type = 'error'
			 ORDER BY created_at DESC, id DESC
			 LIMIT ?`,
		)
		.all(projectId, limit) as Array<Record<string, unknown>>;
	return Object.freeze(rows.map(rowToObservation));
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
