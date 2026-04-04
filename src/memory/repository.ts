import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { lessonMemorySchema } from "../orchestrator/lesson-schemas";
import type { Lesson } from "../orchestrator/lesson-types";
import { OBSERVATION_TYPES } from "./constants";
import { getMemoryDb } from "./database";
import {
	observationSchema,
	preferenceEvidenceSchema,
	preferenceRecordSchema,
	preferenceSchema,
	projectSchema,
} from "./schemas";
import type {
	Observation,
	ObservationType,
	Preference,
	PreferenceEvidence,
	PreferenceRecord,
	Project,
} from "./types";

interface PreferenceRecordRow {
	readonly id: string;
	readonly key: string;
	readonly value: string;
	readonly scope: string;
	readonly project_id: string | null;
	readonly status: string;
	readonly confidence: number;
	readonly source_session: string | null;
	readonly created_at: string;
	readonly last_updated: string;
	readonly evidence_count?: number;
}

interface PreferenceEvidenceRow {
	readonly id: string;
	readonly preference_id: string;
	readonly session_id: string | null;
	readonly run_id: string | null;
	readonly statement: string;
	readonly statement_hash: string;
	readonly confidence: number;
	readonly confirmed: number;
	readonly created_at: string;
}

interface ProjectLessonRow {
	readonly content: string;
	readonly domain: Lesson["domain"];
	readonly extracted_at: string;
	readonly source_phase: Lesson["sourcePhase"];
	readonly last_updated_at: string | null;
}

/** Resolve optional db parameter to singleton fallback. */
function resolveDb(db?: Database): Database {
	return db ?? getMemoryDb();
}

function withWriteTransaction<T>(db: Database, callback: () => T): T {
	const row = db.query("PRAGMA transaction_state").get() as { transaction_state?: string } | null;
	if (row?.transaction_state === "TRANSACTION") {
		return callback();
	}

	db.run("BEGIN IMMEDIATE");
	try {
		const result = callback();
		db.run("COMMIT");
		return result;
	} catch (error: unknown) {
		try {
			db.run("ROLLBACK");
		} catch {
			// Ignore rollback failures so the original error wins.
		}
		throw error;
	}
}

function buildPlaceholders(count: number): string {
	return Array.from({ length: count }, () => "?").join(", ");
}

function normalizePreferenceProjectId(
	scope: PreferenceRecord["scope"],
	projectId: string | null,
): string | null {
	return scope === "project" ? projectId : null;
}

function makePreferenceId(
	key: string,
	scope: PreferenceRecord["scope"],
	projectId: string | null,
): string {
	const normalizedProjectId = normalizePreferenceProjectId(scope, projectId) ?? "global";
	return `pref-${createHash("sha1").update(`${scope}:${normalizedProjectId}:${key}`).digest("hex")}`;
}

function makeEvidenceId(preferenceId: string, statementHash: string): string {
	return `evidence-${createHash("sha1").update(`${preferenceId}:${statementHash}`).digest("hex")}`;
}

function makeStatementHash(statement: string): string {
	return createHash("sha1").update(statement).digest("hex");
}

function tableExists(db: Database, tableName: string): boolean {
	const row = db
		.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
		.get(tableName) as { name?: string } | null;
	return row?.name === tableName;
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

function rowToPreferenceRecord(row: PreferenceRecordRow): PreferenceRecord {
	return preferenceRecordSchema.parse({
		id: row.id,
		key: row.key,
		value: row.value,
		scope: row.scope,
		projectId: row.project_id,
		status: row.status,
		confidence: row.confidence,
		sourceSession: row.source_session,
		createdAt: row.created_at,
		lastUpdated: row.last_updated,
		evidenceCount: row.evidence_count ?? 0,
	});
}

function rowToPreferenceEvidence(row: PreferenceEvidenceRow): PreferenceEvidence {
	return preferenceEvidenceSchema.parse({
		id: row.id,
		preferenceId: row.preference_id,
		sessionId: row.session_id,
		runId: row.run_id,
		statement: row.statement,
		statementHash: row.statement_hash,
		confidence: row.confidence,
		confirmed: row.confirmed === 1,
		createdAt: row.created_at,
	});
}

/** Map a normalized preference record to the compatibility shape. */
function recordToPreference(record: PreferenceRecord): Preference {
	return preferenceSchema.parse({
		id: record.id,
		key: record.key,
		value: record.value,
		confidence: record.confidence,
		scope: record.scope,
		projectId: record.projectId,
		status: record.status,
		evidenceCount: record.evidenceCount,
		sourceSession: record.sourceSession,
		createdAt: record.createdAt,
		lastUpdated: record.lastUpdated,
	});
}

function syncCompatibilityPreference(record: PreferenceRecord, db: Database): void {
	if (record.scope !== "global" || record.status !== "confirmed") {
		db.run("DELETE FROM preferences WHERE id = ?", [record.id]);
		return;
	}

	db.run(
		`INSERT INTO preferences (id, key, value, confidence, source_session, created_at, last_updated)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET
			id = excluded.id,
			key = excluded.key,
			value = excluded.value,
			confidence = excluded.confidence,
			source_session = excluded.source_session,
			created_at = excluded.created_at,
			last_updated = excluded.last_updated`,
		[
			record.id,
			record.key,
			record.value,
			record.confidence,
			record.sourceSession,
			record.createdAt,
			record.lastUpdated,
		],
	);
}

function listPreferenceRecordsSql(baseWhere = ""): string {
	return `SELECT
		pr.*,
		COALESCE(evidence_counts.evidence_count, 0) AS evidence_count
	FROM preference_records pr
	LEFT JOIN (
		SELECT preference_id, COUNT(*) AS evidence_count
		FROM preference_evidence
		GROUP BY preference_id
	) AS evidence_counts ON evidence_counts.preference_id = pr.id
	${baseWhere}
	ORDER BY pr.last_updated DESC, pr.key ASC, pr.id ASC`;
}

function listLegacyLessons(projectId: string, db: Database): readonly Lesson[] {
	if (!tableExists(db, "project_lesson_memory")) {
		return Object.freeze([]);
	}

	const row = db
		.query("SELECT state_json FROM project_lesson_memory WHERE project_id = ?")
		.get(projectId) as { state_json?: string } | null;
	if (row?.state_json === undefined) {
		return Object.freeze([]);
	}

	try {
		const parsed = lessonMemorySchema.parse(JSON.parse(row.state_json));
		return Object.freeze(parsed.lessons);
	} catch {
		return Object.freeze([]);
	}
}

function buildLessonsFromRows(rows: readonly ProjectLessonRow[]): readonly Lesson[] {
	return Object.freeze(
		rows.map((row) =>
			Object.freeze({
				content: row.content,
				domain: row.domain,
				extractedAt: row.extracted_at,
				sourcePhase: row.source_phase,
			}),
		),
	);
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

export interface UpsertPreferenceRecordInput {
	readonly id?: string;
	readonly key: string;
	readonly value: string;
	readonly scope?: PreferenceRecord["scope"];
	readonly projectId?: string | null;
	readonly status?: PreferenceRecord["status"];
	readonly confidence?: number;
	readonly sourceSession?: string | null;
	readonly createdAt: string;
	readonly lastUpdated: string;
	readonly evidence?: readonly {
		readonly sessionId?: string | null;
		readonly runId?: string | null;
		readonly statement: string;
		readonly confidence?: number;
		readonly confirmed?: boolean;
		readonly createdAt?: string;
	}[];
}

export interface ListPreferenceRecordOptions {
	readonly scope?: PreferenceRecord["scope"];
	readonly projectId?: string | null;
	readonly status?: PreferenceRecord["status"];
	readonly onlyConfirmed?: boolean;
	readonly limit?: number;
}

export type PreferenceUpsertInput = Omit<
	Preference,
	"scope" | "projectId" | "status" | "evidenceCount"
> &
	Partial<Pick<Preference, "scope" | "projectId" | "status" | "evidenceCount">>;

export type PreferencePruneStatus = PreferenceRecord["status"] | "unconfirmed" | "any";

export interface PreferenceMutationResult {
	readonly deletedPreferences: number;
	readonly deletedEvidence: number;
}

export interface PreferencePruneOptions {
	readonly olderThanDays: number;
	readonly scope?: PreferenceRecord["scope"];
	readonly projectId?: string | null;
	readonly status?: PreferencePruneStatus;
}

export interface PreferenceEvidencePruneOptions {
	readonly olderThanDays: number;
	readonly keepLatestPerPreference?: number;
	readonly scope?: PreferenceRecord["scope"];
	readonly projectId?: string | null;
	readonly status?: PreferencePruneStatus;
}

function isPreferenceStatusMatch(record: PreferenceRecord, status: PreferencePruneStatus): boolean {
	if (status === "any") {
		return true;
	}
	if (status === "unconfirmed") {
		return record.status !== "confirmed";
	}
	return record.status === status;
}

/**
 * Create or replace a structured preference record and its supporting evidence.
 */
export function upsertPreferenceRecord(
	input: UpsertPreferenceRecordInput,
	db?: Database,
): PreferenceRecord {
	const d = resolveDb(db);
	const scope = input.scope ?? "global";
	const normalizedProjectId = normalizePreferenceProjectId(scope, input.projectId ?? null);
	if (scope === "project" && normalizedProjectId === null) {
		throw new Error("project-scoped preferences require a projectId");
	}
	const validated = preferenceRecordSchema.parse({
		id: input.id ?? makePreferenceId(input.key, scope, normalizedProjectId),
		key: input.key,
		value: input.value,
		scope,
		projectId: normalizedProjectId,
		status: input.status ?? "confirmed",
		confidence: input.confidence ?? 0.5,
		sourceSession: input.sourceSession ?? null,
		createdAt: input.createdAt,
		lastUpdated: input.lastUpdated,
		evidenceCount: input.evidence?.length ?? 0,
	});

	d.run("BEGIN IMMEDIATE");
	try {
		d.run(
			`INSERT INTO preference_records (
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
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				key = excluded.key,
				value = excluded.value,
				scope = excluded.scope,
				project_id = excluded.project_id,
				status = excluded.status,
				confidence = excluded.confidence,
				source_session = excluded.source_session,
				created_at = excluded.created_at,
				last_updated = excluded.last_updated`,
			[
				validated.id,
				validated.key,
				validated.value,
				validated.scope,
				validated.projectId,
				validated.status,
				validated.confidence,
				validated.sourceSession,
				validated.createdAt,
				validated.lastUpdated,
			],
		);

		for (const evidence of input.evidence ?? []) {
			const statementHash = makeStatementHash(evidence.statement);
			const validatedEvidence = preferenceEvidenceSchema.parse({
				id: makeEvidenceId(validated.id, statementHash),
				preferenceId: validated.id,
				sessionId: evidence.sessionId ?? validated.sourceSession,
				runId: evidence.runId ?? null,
				statement: evidence.statement,
				statementHash,
				confidence: evidence.confidence ?? validated.confidence,
				confirmed: evidence.confirmed ?? validated.status === "confirmed",
				createdAt: evidence.createdAt ?? validated.lastUpdated,
			});

			d.run(
				`INSERT INTO preference_evidence (
					id,
					preference_id,
					session_id,
					run_id,
					statement,
					statement_hash,
					confidence,
					confirmed,
					created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					session_id = excluded.session_id,
					run_id = excluded.run_id,
					statement = excluded.statement,
					confidence = excluded.confidence,
					confirmed = excluded.confirmed,
					created_at = excluded.created_at`,
				[
					validatedEvidence.id,
					validatedEvidence.preferenceId,
					validatedEvidence.sessionId,
					validatedEvidence.runId,
					validatedEvidence.statement,
					validatedEvidence.statementHash,
					validatedEvidence.confidence,
					validatedEvidence.confirmed ? 1 : 0,
					validatedEvidence.createdAt,
				],
			);
		}

		syncCompatibilityPreference(validated, d);
		d.run("COMMIT");
	} catch (error: unknown) {
		try {
			d.run("ROLLBACK");
		} catch {
			// Ignore rollback failures so the original error wins.
		}
		throw error;
	}

	return getPreferenceRecordById(validated.id, d) ?? validated;
}

export function getPreferenceRecordById(id: string, db?: Database): PreferenceRecord | null {
	const d = resolveDb(db);
	if (!tableExists(d, "preference_records")) {
		return null;
	}

	const row = d
		.query(`${listPreferenceRecordsSql("WHERE pr.id = ?")} LIMIT 1`)
		.get(id) as PreferenceRecordRow | null;
	return row ? rowToPreferenceRecord(row) : null;
}

export function listPreferenceRecords(
	options: ListPreferenceRecordOptions = {},
	db?: Database,
): readonly PreferenceRecord[] {
	const d = resolveDb(db);
	if (!tableExists(d, "preference_records")) {
		return getAllPreferences(d).map((preference) =>
			preferenceRecordSchema.parse({
				...preference,
				scope: preference.scope,
				projectId: preference.projectId,
				status: preference.status,
				evidenceCount: preference.evidenceCount,
			}),
		);
	}

	const conditions: string[] = [];
	const params: Array<string | number> = [];

	if (options.scope) {
		conditions.push("pr.scope = ?");
		params.push(options.scope);
	}
	if (Object.hasOwn(options, "projectId")) {
		if (options.projectId === null) {
			conditions.push("pr.project_id IS NULL");
		} else if (typeof options.projectId === "string") {
			conditions.push("pr.project_id = ?");
			params.push(options.projectId);
		}
	}
	if (options.onlyConfirmed === true) {
		conditions.push("pr.status = 'confirmed'");
	} else if (options.status) {
		conditions.push("pr.status = ?");
		params.push(options.status);
	}

	let sql = listPreferenceRecordsSql(
		conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
	);
	if (typeof options.limit === "number") {
		sql = `${sql} LIMIT ?`;
		params.push(Math.max(1, options.limit));
	}

	const rows = d.query(sql).all(...params) as PreferenceRecordRow[];
	return Object.freeze(rows.map(rowToPreferenceRecord));
}

export function listPreferenceEvidence(
	preferenceId: string,
	db?: Database,
): readonly PreferenceEvidence[] {
	const d = resolveDb(db);
	if (!tableExists(d, "preference_evidence")) {
		return Object.freeze([]);
	}

	const rows = d
		.query(
			`SELECT *
			 FROM preference_evidence
			 WHERE preference_id = ?
			 ORDER BY created_at DESC, id DESC`,
		)
		.all(preferenceId) as PreferenceEvidenceRow[];
	return Object.freeze(rows.map(rowToPreferenceEvidence));
}

function selectPrunablePreferenceRecords(
	options: PreferencePruneOptions,
	db: Database,
): readonly PreferenceRecord[] {
	const cutoff = new Date(
		Date.now() - Math.max(1, options.olderThanDays) * 24 * 60 * 60 * 1000,
	).toISOString();
	const status = options.status ?? "unconfirmed";
	const records = listPreferenceRecords(
		{
			scope: options.scope,
			projectId: options.projectId,
			status:
				status === "candidate" || status === "confirmed" || status === "rejected"
					? status
					: undefined,
		},
		db,
	);
	return Object.freeze(
		records.filter(
			(record) => isPreferenceStatusMatch(record, status) && record.lastUpdated < cutoff,
		),
	);
}

function deletePreferenceRecordsByIds(
	ids: readonly string[],
	db: Database,
): PreferenceMutationResult {
	if (ids.length === 0) {
		return Object.freeze({ deletedPreferences: 0, deletedEvidence: 0 });
	}

	if (!tableExists(db, "preference_records")) {
		const placeholders = buildPlaceholders(ids.length);
		const deletedPreferences =
			(
				db
					.query(`SELECT COUNT(*) AS cnt FROM preferences WHERE id IN (${placeholders})`)
					.get(...ids) as { cnt?: number } | null
			)?.cnt ?? 0;
		if (deletedPreferences > 0) {
			db.run(`DELETE FROM preferences WHERE id IN (${placeholders})`, [...ids]);
		}
		return Object.freeze({ deletedPreferences, deletedEvidence: 0 });
	}

	const placeholders = buildPlaceholders(ids.length);
	const records = db
		.query(`SELECT * FROM preference_records WHERE id IN (${placeholders})`)
		.all(...ids) as PreferenceRecordRow[];
	if (records.length === 0) {
		return Object.freeze({ deletedPreferences: 0, deletedEvidence: 0 });
	}

	const deletedEvidence = tableExists(db, "preference_evidence")
		? ((
				db
					.query(
						`SELECT COUNT(*) AS cnt FROM preference_evidence WHERE preference_id IN (${placeholders})`,
					)
					.get(...ids) as { cnt?: number } | null
			)?.cnt ?? 0)
		: 0;

	withWriteTransaction(db, () => {
		for (const record of records) {
			if (record.scope === "global") {
				db.run("DELETE FROM preferences WHERE id = ? OR key = ?", [record.id, record.key]);
			}
		}
		db.run(`DELETE FROM preference_records WHERE id IN (${placeholders})`, [...ids]);
	});

	return Object.freeze({
		deletedPreferences: records.length,
		deletedEvidence,
	});
}

export function deletePreferenceRecord(id: string, db?: Database): PreferenceMutationResult {
	return deletePreferenceRecordsByIds([id], resolveDb(db));
}

export function deletePreferencesByKey(
	key: string,
	options: { readonly scope?: PreferenceRecord["scope"]; readonly projectId?: string | null } = {},
	db?: Database,
): PreferenceMutationResult {
	const d = resolveDb(db);
	const records = listPreferenceRecords(
		{
			scope: options.scope,
			projectId: options.projectId,
		},
		d,
	).filter((record) => record.key === key);
	return deletePreferenceRecordsByIds(
		records.map((record) => record.id),
		d,
	);
}

export function prunePreferences(
	options: PreferencePruneOptions,
	db?: Database,
): PreferenceMutationResult {
	const d = resolveDb(db);
	const records = selectPrunablePreferenceRecords(options, d);
	return deletePreferenceRecordsByIds(
		records.map((record) => record.id),
		d,
	);
}

export function prunePreferenceEvidence(
	options: PreferenceEvidencePruneOptions,
	db?: Database,
): PreferenceMutationResult {
	const d = resolveDb(db);
	if (!tableExists(d, "preference_evidence") || !tableExists(d, "preference_records")) {
		return Object.freeze({ deletedPreferences: 0, deletedEvidence: 0 });
	}

	const cutoff = new Date(
		Date.now() - Math.max(1, options.olderThanDays) * 24 * 60 * 60 * 1000,
	).toISOString();
	const keepLatestPerPreference = Math.max(0, options.keepLatestPerPreference ?? 1);
	const status = options.status ?? "any";
	const records = listPreferenceRecords(
		{
			scope: options.scope,
			projectId: options.projectId,
			status:
				status === "candidate" || status === "confirmed" || status === "rejected"
					? status
					: undefined,
		},
		d,
	).filter((record) => isPreferenceStatusMatch(record, status));

	let deletedEvidence = 0;
	withWriteTransaction(d, () => {
		for (const record of records) {
			const evidence = listPreferenceEvidence(record.id, d);
			const removable = evidence
				.slice(keepLatestPerPreference)
				.filter((entry) => entry.createdAt < cutoff);
			if (removable.length === 0) {
				continue;
			}

			const placeholders = buildPlaceholders(removable.length);
			d.run(
				`DELETE FROM preference_evidence WHERE id IN (${placeholders})`,
				removable.map((entry) => entry.id),
			);
			deletedEvidence += removable.length;
		}
	});

	return Object.freeze({ deletedPreferences: 0, deletedEvidence });
}

export function listRelevantLessons(
	projectId: string,
	limit = 5,
	db?: Database,
): readonly Lesson[] {
	const d = resolveDb(db);
	if (tableExists(d, "project_lessons")) {
		const rows = d
			.query(
				`SELECT content, domain, extracted_at, source_phase, last_updated_at
				 FROM project_lessons
				 WHERE project_id = ?
				 ORDER BY extracted_at DESC, lesson_id DESC
				 LIMIT ?`,
			)
			.all(projectId, limit) as ProjectLessonRow[];
		if (rows.length > 0) {
			return buildLessonsFromRows(rows);
		}
	}

	return listLegacyLessons(projectId, d).slice(0, limit);
}

/**
 * Create or replace a preference by its id.
 * Compatibility wrapper that stores a confirmed global preference record.
 */
export function upsertPreference(pref: PreferenceUpsertInput, db?: Database): void {
	const validated = preferenceSchema.parse({
		scope: "global",
		projectId: null,
		status: "confirmed",
		evidenceCount: 0,
		...pref,
	});
	upsertPreferenceRecord(
		{
			id: validated.id,
			key: validated.key,
			value: validated.value,
			scope: validated.scope,
			projectId: validated.projectId,
			status: validated.status,
			confidence: validated.confidence,
			sourceSession: validated.sourceSession,
			createdAt: validated.createdAt,
			lastUpdated: validated.lastUpdated,
			evidence:
				validated.sourceSession === null
					? []
					: [
							{
								sessionId: validated.sourceSession,
								statement: `${validated.key}: ${validated.value}`,
								confidence: validated.confidence,
								confirmed: validated.status === "confirmed",
								createdAt: validated.lastUpdated,
							},
						],
		},
		db,
	);
}

/**
 * Get all compatibility preferences.
 */
export function getAllPreferences(db?: Database): readonly Preference[] {
	const d = resolveDb(db);
	if (!tableExists(d, "preference_records")) {
		const rows = d
			.query("SELECT * FROM preferences ORDER BY last_updated DESC, key ASC")
			.all() as Array<Record<string, unknown>>;
		return rows.map((row) =>
			preferenceSchema.parse({
				id: row.id as string,
				key: row.key as string,
				value: row.value as string,
				confidence: row.confidence as number,
				scope: "global",
				projectId: null,
				status: "confirmed",
				evidenceCount: 0,
				sourceSession: (row.source_session as string) ?? null,
				createdAt: row.created_at as string,
				lastUpdated: row.last_updated as string,
			}),
		);
	}

	const projected: Preference[] = [];
	const seen = new Set<string>();
	for (const record of listPreferenceRecords({ onlyConfirmed: true }, d)) {
		const uniquenessKey = `${record.scope}:${record.projectId ?? "global"}:${record.key}`;
		if (seen.has(uniquenessKey)) {
			continue;
		}
		seen.add(uniquenessKey);
		projected.push(recordToPreference(record));
	}
	return Object.freeze(projected);
}

export function getConfirmedPreferencesForProject(
	projectId: string,
	db?: Database,
): readonly Preference[] {
	const d = resolveDb(db);
	const globalPrefs = listPreferenceRecords({ scope: "global", onlyConfirmed: true, limit: 5 }, d);
	const projectPrefs = listPreferenceRecords(
		{ scope: "project", projectId, onlyConfirmed: true, limit: 5 },
		d,
	);
	return Object.freeze([...projectPrefs, ...globalPrefs].map(recordToPreference));
}

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
