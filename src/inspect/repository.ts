import type { Database } from "bun:sqlite";
import { Database as SqliteDatabase } from "bun:sqlite";
import { existsSync, statSync } from "node:fs";
import { OBSERVATION_TYPES } from "../memory/constants";
import { preferenceEvidenceSchema, preferenceSchema } from "../memory/schemas";
import type { Preference, PreferenceEvidence } from "../memory/types";
import { lessonMemorySchema } from "../orchestrator/lesson-schemas";
import type { Lesson } from "../orchestrator/lesson-types";
import {
	getProjectByAnyPath,
	getProjectById,
	listProjectGitFingerprints,
	listProjectPaths,
} from "../projects/repository";
import { projectRecordSchema } from "../projects/schemas";
import type { ProjectGitFingerprint, ProjectPathRecord, ProjectRecord } from "../projects/types";
import { getAutopilotDbPath } from "../utils/paths";

type InspectDbInput = Database | string | undefined;

interface ProjectRow {
	readonly id: string;
	readonly path: string;
	readonly name: string;
	readonly first_seen_at: string | null;
	readonly last_updated: string;
}

interface ProjectCountRow extends ProjectRow {
	readonly path_count: number;
	readonly fingerprint_count: number;
	readonly run_count: number;
	readonly event_count: number;
	readonly observation_count: number;
	readonly has_active_review_state: number;
	readonly has_review_memory: number;
}

interface PipelineRunSummaryRow {
	readonly project_id: string;
	readonly project_name: string;
	readonly project_path: string;
	readonly run_id: string;
	readonly status: string;
	readonly current_phase: string | null;
	readonly idea: string;
	readonly state_revision: number;
	readonly started_at: string;
	readonly last_updated_at: string;
	readonly failure_phase: string | null;
	readonly failure_agent: string | null;
	readonly failure_message: string | null;
	readonly last_successful_phase: string | null;
}

interface ForensicEventSummaryRow {
	readonly event_id: number;
	readonly project_id: string;
	readonly project_name: string;
	readonly project_path: string;
	readonly timestamp: string;
	readonly domain: string;
	readonly run_id: string | null;
	readonly session_id: string | null;
	readonly parent_session_id: string | null;
	readonly phase: string | null;
	readonly dispatch_id: string | null;
	readonly task_id: number | null;
	readonly agent: string | null;
	readonly type: string;
	readonly code: string | null;
	readonly message: string | null;
	readonly payload_json: string;
}

interface LessonMemoryRow {
	readonly project_id: string;
	readonly project_name: string;
	readonly project_path: string;
	readonly state_json: string;
	readonly last_updated_at: string | null;
}

interface PreferenceRow {
	readonly id: string;
	readonly key: string;
	readonly value: string;
	readonly scope?: string;
	readonly project_id?: string | null;
	readonly status?: string;
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

interface ObservationRow {
	readonly id: number;
	readonly project_id: string | null;
	readonly project_name: string | null;
	readonly session_id: string;
	readonly type: string;
	readonly summary: string;
	readonly confidence: number;
	readonly created_at: string;
}

interface CountRow {
	readonly cnt: number;
}

interface TypeCountRow {
	readonly type: string;
	readonly cnt: number;
}

function tableExists(db: Database, tableName: string): boolean {
	const row = db
		.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
		.get(tableName) as { name?: string } | null;
	return row?.name === tableName;
}

function countSubquery(tableName: string, alias: string): string {
	return `SELECT project_id, COUNT(*) AS ${alias} FROM ${tableName} GROUP BY project_id`;
}

function emptyCountSubquery(alias: string): string {
	return `SELECT NULL AS project_id, 0 AS ${alias} WHERE 0`;
}

export interface InspectProjectSummary {
	readonly id: string;
	readonly name: string;
	readonly path: string;
	readonly firstSeenAt: string;
	readonly lastUpdated: string;
	readonly pathCount: number;
	readonly fingerprintCount: number;
	readonly runCount: number;
	readonly eventCount: number;
	readonly observationCount: number;
	readonly lessonCount: number;
	readonly hasActiveReviewState: boolean;
	readonly hasReviewMemory: boolean;
}

export interface InspectProjectDetails {
	readonly project: InspectProjectSummary;
	readonly paths: readonly ProjectPathRecord[];
	readonly gitFingerprints: readonly ProjectGitFingerprint[];
}

export interface InspectRunSummary {
	readonly projectId: string;
	readonly projectName: string;
	readonly projectPath: string;
	readonly runId: string;
	readonly status: string;
	readonly currentPhase: string | null;
	readonly idea: string;
	readonly stateRevision: number;
	readonly startedAt: string;
	readonly lastUpdatedAt: string;
	readonly failurePhase: string | null;
	readonly failureAgent: string | null;
	readonly failureMessage: string | null;
	readonly lastSuccessfulPhase: string | null;
}

export interface InspectEventSummary {
	readonly eventId: number;
	readonly projectId: string;
	readonly projectName: string;
	readonly projectPath: string;
	readonly timestamp: string;
	readonly domain: string;
	readonly runId: string | null;
	readonly sessionId: string | null;
	readonly parentSessionId: string | null;
	readonly phase: string | null;
	readonly dispatchId: string | null;
	readonly taskId: number | null;
	readonly agent: string | null;
	readonly type: string;
	readonly code: string | null;
	readonly message: string | null;
	readonly payload: Record<string, unknown>;
}

export interface InspectLessonSummary {
	readonly projectId: string;
	readonly projectName: string;
	readonly projectPath: string;
	readonly extractedAt: string;
	readonly domain: Lesson["domain"];
	readonly sourcePhase: Lesson["sourcePhase"];
	readonly content: string;
	readonly lastUpdatedAt: string | null;
}

export interface InspectPreferenceSummary extends Preference {
	readonly evidence: readonly PreferenceEvidence[];
}

export interface InspectObservationSummary {
	readonly id: number;
	readonly projectId: string | null;
	readonly projectName: string | null;
	readonly sessionId: string;
	readonly type: string;
	readonly summary: string;
	readonly confidence: number;
	readonly createdAt: string;
}

export interface InspectMemoryOverview {
	readonly stats: {
		readonly totalObservations: number;
		readonly totalProjects: number;
		readonly totalPreferences: number;
		readonly storageSizeKb: number;
		readonly observationsByType: Readonly<Record<string, number>>;
	};
	readonly recentObservations: readonly InspectObservationSummary[];
	readonly preferences: readonly InspectPreferenceSummary[];
}

export interface InspectRunQuery {
	readonly projectRef?: string;
	readonly limit?: number;
}

export interface InspectEventQuery {
	readonly projectRef?: string;
	readonly runId?: string;
	readonly sessionId?: string;
	readonly type?: string;
	readonly limit?: number;
}

export interface InspectLessonQuery {
	readonly projectRef?: string;
	readonly limit?: number;
}

function rowToProject(row: ProjectRow): ProjectRecord {
	return projectRecordSchema.parse({
		id: row.id,
		path: row.path,
		name: row.name,
		firstSeenAt: row.first_seen_at ?? row.last_updated,
		lastUpdated: row.last_updated,
	});
}

function safeParseJson(value: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(value) as unknown;
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function rowToPreference(row: PreferenceRow): InspectPreferenceSummary {
	return preferenceSchema.parse({
		id: row.id,
		key: row.key,
		value: row.value,
		scope: row.scope ?? "global",
		projectId: row.project_id ?? null,
		status: row.status ?? "confirmed",
		confidence: row.confidence,
		evidenceCount: row.evidence_count ?? 0,
		sourceSession: row.source_session,
		createdAt: row.created_at,
		lastUpdated: row.last_updated,
	}) as InspectPreferenceSummary;
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

function countLessonsByProject(rows: readonly LessonMemoryRow[]): ReadonlyMap<string, number> {
	const counts = new Map<string, number>();

	for (const row of rows) {
		const parsed = lessonMemorySchema.safeParse(safeParseJson(row.state_json));
		if (!parsed.success) {
			counts.set(row.project_id, 0);
			continue;
		}
		counts.set(row.project_id, parsed.data.lessons.length);
	}

	return counts;
}

function openInspectDb(input: InspectDbInput): {
	readonly db: Database;
	readonly dbPath: string | null;
	close: () => void;
} | null {
	if (input instanceof SqliteDatabase) {
		return {
			db: input,
			dbPath: null,
			close() {},
		};
	}

	const dbPath = typeof input === "string" ? input : getAutopilotDbPath();
	if (!existsSync(dbPath)) {
		return null;
	}

	const db = new SqliteDatabase(dbPath, { readonly: true });
	return {
		db,
		dbPath,
		close() {
			db.close();
		},
	};
}

function withInspectDb<T>(
	input: InspectDbInput,
	onMissing: T,
	callback: (db: Database, dbPath: string | null) => T,
): T {
	const handle = openInspectDb(input);
	if (handle === null) {
		return onMissing;
	}

	try {
		return callback(handle.db, handle.dbPath);
	} finally {
		handle.close();
	}
}

function resolveProjectReferenceInDb(projectRef: string, db: Database): ProjectRecord | null {
	const trimmed = projectRef.trim();
	if (trimmed.length === 0) {
		return null;
	}

	const byId = getProjectById(trimmed, db);
	if (byId !== null) {
		return byId;
	}

	const byPath = getProjectByAnyPath(trimmed, db);
	if (byPath !== null) {
		return byPath;
	}

	const nameMatches = db
		.query("SELECT * FROM projects WHERE name = ? ORDER BY last_updated DESC, id DESC LIMIT 2")
		.all(trimmed) as ProjectRow[];
	if (nameMatches.length === 1) {
		return rowToProject(nameMatches[0]);
	}
	if (nameMatches.length > 1) {
		throw new Error(`Project reference '${trimmed}' is ambiguous; use project id or path.`);
	}

	return null;
}

function buildProjectSummary(
	row: ProjectCountRow,
	lessonCounts: ReadonlyMap<string, number>,
): InspectProjectSummary {
	return Object.freeze({
		id: row.id,
		name: row.name,
		path: row.path,
		firstSeenAt: row.first_seen_at ?? row.last_updated,
		lastUpdated: row.last_updated,
		pathCount: row.path_count,
		fingerprintCount: row.fingerprint_count,
		runCount: row.run_count,
		eventCount: row.event_count,
		observationCount: row.observation_count,
		lessonCount: lessonCounts.get(row.id) ?? 0,
		hasActiveReviewState: row.has_active_review_state === 1,
		hasReviewMemory: row.has_review_memory === 1,
	});
}

function readProjectRows(db: Database): readonly ProjectCountRow[] {
	const runCounts = tableExists(db, "pipeline_runs")
		? countSubquery("pipeline_runs", "run_count")
		: emptyCountSubquery("run_count");
	const eventCounts = tableExists(db, "forensic_events")
		? countSubquery("forensic_events", "event_count")
		: emptyCountSubquery("event_count");
	const observationCounts = tableExists(db, "observations")
		? countSubquery("observations", "observation_count")
		: emptyCountSubquery("observation_count");
	const activeReviewJoin = tableExists(db, "active_review_state")
		? "LEFT JOIN active_review_state ars ON ars.project_id = p.id"
		: "LEFT JOIN (SELECT NULL AS project_id WHERE 0) ars ON ars.project_id = p.id";
	const reviewMemoryJoin = tableExists(db, "project_review_memory")
		? "LEFT JOIN project_review_memory prm ON prm.project_id = p.id"
		: "LEFT JOIN (SELECT NULL AS project_id WHERE 0) prm ON prm.project_id = p.id";

	return Object.freeze(
		db
			.query(
				`SELECT
					p.*,
					COALESCE(path_counts.path_count, 0) AS path_count,
					COALESCE(fingerprint_counts.fingerprint_count, 0) AS fingerprint_count,
					COALESCE(run_counts.run_count, 0) AS run_count,
					COALESCE(event_counts.event_count, 0) AS event_count,
					COALESCE(observation_counts.observation_count, 0) AS observation_count,
					CASE WHEN ars.project_id IS NULL THEN 0 ELSE 1 END AS has_active_review_state,
					CASE WHEN prm.project_id IS NULL THEN 0 ELSE 1 END AS has_review_memory
				 FROM projects p
				 LEFT JOIN (
					SELECT project_id, COUNT(*) AS path_count
					FROM project_paths
					GROUP BY project_id
				 ) AS path_counts ON path_counts.project_id = p.id
				 LEFT JOIN (
					SELECT project_id, COUNT(*) AS fingerprint_count
					FROM project_git_fingerprints
					GROUP BY project_id
				 ) AS fingerprint_counts ON fingerprint_counts.project_id = p.id
				 LEFT JOIN (${runCounts}) AS run_counts ON run_counts.project_id = p.id
				 LEFT JOIN (${eventCounts}) AS event_counts ON event_counts.project_id = p.id
				 LEFT JOIN (${observationCounts}) AS observation_counts ON observation_counts.project_id = p.id
				 ${activeReviewJoin}
				 ${reviewMemoryJoin}
				 ORDER BY p.last_updated DESC, p.name ASC, p.id ASC`,
			)
			.all() as ProjectCountRow[],
	);
}

export function listProjects(input?: InspectDbInput): readonly InspectProjectSummary[] {
	return withInspectDb(input, Object.freeze([]), (db) => {
		const projectRows = readProjectRows(db);
		const lessonRows = tableExists(db, "project_lesson_memory")
			? (db
					.query(
						`SELECT plm.project_id, p.name AS project_name, p.path AS project_path, plm.state_json, plm.last_updated_at
						 FROM project_lesson_memory plm
						 JOIN projects p ON p.id = plm.project_id`,
					)
					.all() as LessonMemoryRow[])
			: [];
		const lessonCounts = countLessonsByProject(lessonRows);
		return Object.freeze(projectRows.map((row) => buildProjectSummary(row, lessonCounts)));
	});
}

export function getProjectDetails(
	projectRef: string,
	input?: InspectDbInput,
): InspectProjectDetails | null {
	return withInspectDb(input, null, (db) => {
		const resolvedProject = resolveProjectReferenceInDb(projectRef, db);
		if (resolvedProject === null) {
			return null;
		}

		const projectRows = readProjectRows(db);
		const projectRow = projectRows.find((row) => row.id === resolvedProject.id);
		if (projectRow === undefined) {
			return null;
		}

		const lessonRows = tableExists(db, "project_lesson_memory")
			? (db
					.query(
						`SELECT plm.project_id, p.name AS project_name, p.path AS project_path, plm.state_json, plm.last_updated_at
						 FROM project_lesson_memory plm
						 JOIN projects p ON p.id = plm.project_id
						 WHERE plm.project_id = ?`,
					)
					.all(resolvedProject.id) as LessonMemoryRow[])
			: [];
		const lessonCounts = countLessonsByProject(lessonRows);

		return Object.freeze({
			project: buildProjectSummary(projectRow, lessonCounts),
			paths: listProjectPaths(resolvedProject.id, db),
			gitFingerprints: listProjectGitFingerprints(resolvedProject.id, db),
		});
	});
}

export function listProjectPathsByReference(
	projectRef: string,
	input?: InspectDbInput,
): readonly ProjectPathRecord[] {
	return withInspectDb(input, Object.freeze([]), (db) => {
		const resolvedProject = resolveProjectReferenceInDb(projectRef, db);
		if (resolvedProject === null) {
			return Object.freeze([]);
		}
		return listProjectPaths(resolvedProject.id, db);
	});
}

export function listRuns(
	query: InspectRunQuery = {},
	input?: InspectDbInput,
): readonly InspectRunSummary[] {
	return withInspectDb(input, Object.freeze([]), (db) => {
		if (!tableExists(db, "pipeline_runs")) {
			return Object.freeze([]);
		}

		const limit = Math.max(1, query.limit ?? 20);
		const resolvedProject =
			typeof query.projectRef === "string"
				? resolveProjectReferenceInDb(query.projectRef, db)
				: null;
		if (query.projectRef && resolvedProject === null) {
			return Object.freeze([]);
		}

		const rows = resolvedProject
			? (db
					.query(
						`SELECT pr.*, p.name AS project_name, p.path AS project_path
						 FROM pipeline_runs pr
						 JOIN projects p ON p.id = pr.project_id
						 WHERE pr.project_id = ?
						 ORDER BY pr.last_updated_at DESC, pr.run_id DESC
						 LIMIT ?`,
					)
					.all(resolvedProject.id, limit) as PipelineRunSummaryRow[])
			: (db
					.query(
						`SELECT pr.*, p.name AS project_name, p.path AS project_path
						 FROM pipeline_runs pr
						 JOIN projects p ON p.id = pr.project_id
						 ORDER BY pr.last_updated_at DESC, pr.run_id DESC
						 LIMIT ?`,
					)
					.all(limit) as PipelineRunSummaryRow[]);

		return Object.freeze(
			rows.map((row) =>
				Object.freeze({
					projectId: row.project_id,
					projectName: row.project_name,
					projectPath: row.project_path,
					runId: row.run_id,
					status: row.status,
					currentPhase: row.current_phase,
					idea: row.idea,
					stateRevision: row.state_revision,
					startedAt: row.started_at,
					lastUpdatedAt: row.last_updated_at,
					failurePhase: row.failure_phase,
					failureAgent: row.failure_agent,
					failureMessage: row.failure_message,
					lastSuccessfulPhase: row.last_successful_phase,
				}),
			),
		);
	});
}

export function listEvents(
	query: InspectEventQuery = {},
	input?: InspectDbInput,
): readonly InspectEventSummary[] {
	return withInspectDb(input, Object.freeze([]), (db) => {
		if (!tableExists(db, "forensic_events")) {
			return Object.freeze([]);
		}

		const limit = Math.max(1, query.limit ?? 50);
		const resolvedProject =
			typeof query.projectRef === "string"
				? resolveProjectReferenceInDb(query.projectRef, db)
				: null;
		if (query.projectRef && resolvedProject === null) {
			return Object.freeze([]);
		}

		const conditions: string[] = [];
		const params: Array<string | number> = [];

		if (resolvedProject !== null) {
			conditions.push("fe.project_id = ?");
			params.push(resolvedProject.id);
		}
		if (query.runId) {
			conditions.push("fe.run_id = ?");
			params.push(query.runId);
		}
		if (query.sessionId) {
			conditions.push("fe.session_id = ?");
			params.push(query.sessionId);
		}
		if (query.type) {
			conditions.push("fe.type = ?");
			params.push(query.type);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const rows = db
			.query(
				`SELECT
					fe.*,
					p.name AS project_name,
					p.path AS project_path
				 FROM forensic_events fe
				 JOIN projects p ON p.id = fe.project_id
				 ${whereClause}
				 ORDER BY fe.timestamp DESC, fe.event_id DESC
				 LIMIT ?`,
			)
			.all(...params, limit) as ForensicEventSummaryRow[];

		return Object.freeze(
			rows.map((row) =>
				Object.freeze({
					eventId: row.event_id,
					projectId: row.project_id,
					projectName: row.project_name,
					projectPath: row.project_path,
					timestamp: row.timestamp,
					domain: row.domain,
					runId: row.run_id,
					sessionId: row.session_id,
					parentSessionId: row.parent_session_id,
					phase: row.phase,
					dispatchId: row.dispatch_id,
					taskId: row.task_id,
					agent: row.agent,
					type: row.type,
					code: row.code,
					message: row.message,
					payload: safeParseJson(row.payload_json),
				}),
			),
		);
	});
}

export function listLessons(
	query: InspectLessonQuery = {},
	input?: InspectDbInput,
): readonly InspectLessonSummary[] {
	return withInspectDb(input, Object.freeze([]), (db) => {
		if (!tableExists(db, "project_lesson_memory")) {
			return Object.freeze([]);
		}

		const limit = Math.max(1, query.limit ?? 50);
		const resolvedProject =
			typeof query.projectRef === "string"
				? resolveProjectReferenceInDb(query.projectRef, db)
				: null;
		if (query.projectRef && resolvedProject === null) {
			return Object.freeze([]);
		}

		const rows = resolvedProject
			? (db
					.query(
						`SELECT plm.project_id, p.name AS project_name, p.path AS project_path, plm.state_json, plm.last_updated_at
						 FROM project_lesson_memory plm
						 JOIN projects p ON p.id = plm.project_id
						 WHERE plm.project_id = ?`,
					)
					.all(resolvedProject.id) as LessonMemoryRow[])
			: (db
					.query(
						`SELECT plm.project_id, p.name AS project_name, p.path AS project_path, plm.state_json, plm.last_updated_at
						 FROM project_lesson_memory plm
						 JOIN projects p ON p.id = plm.project_id`,
					)
					.all() as LessonMemoryRow[]);

		const lessons: InspectLessonSummary[] = [];
		for (const row of rows) {
			const parsed = lessonMemorySchema.safeParse(safeParseJson(row.state_json));
			if (!parsed.success) {
				continue;
			}

			for (const lesson of parsed.data.lessons) {
				lessons.push(
					Object.freeze({
						projectId: row.project_id,
						projectName: row.project_name,
						projectPath: row.project_path,
						extractedAt: lesson.extractedAt,
						domain: lesson.domain,
						sourcePhase: lesson.sourcePhase,
						content: lesson.content,
						lastUpdatedAt: row.last_updated_at,
					}),
				);
			}
		}

		lessons.sort((a, b) => b.extractedAt.localeCompare(a.extractedAt));
		return Object.freeze(lessons.slice(0, limit));
	});
}

export function listPreferences(input?: InspectDbInput): readonly InspectPreferenceSummary[] {
	return withInspectDb(input, Object.freeze([]), (db) => {
		if (tableExists(db, "preference_records")) {
			const rows = db
				.query(
					`SELECT
						pr.*,
						COALESCE(evidence_counts.evidence_count, 0) AS evidence_count
					 FROM preference_records pr
					 LEFT JOIN (
						SELECT preference_id, COUNT(*) AS evidence_count
						FROM preference_evidence
						GROUP BY preference_id
					 ) AS evidence_counts ON evidence_counts.preference_id = pr.id
					 ORDER BY pr.last_updated DESC, pr.key ASC, pr.id ASC`,
				)
				.all() as PreferenceRow[];

			return Object.freeze(
				rows.map((row) => {
					const evidence = tableExists(db, "preference_evidence")
						? (db
								.query(
									`SELECT *
									 FROM preference_evidence
									 WHERE preference_id = ?
									 ORDER BY created_at DESC, id DESC`,
								)
								.all(row.id) as PreferenceEvidenceRow[])
						: [];

					return Object.freeze({
						...rowToPreference(row),
						evidence: Object.freeze(evidence.map(rowToPreferenceEvidence)),
					});
				}),
			);
		}

		const rows = db
			.query("SELECT * FROM preferences ORDER BY last_updated DESC, key ASC")
			.all() as PreferenceRow[];
		return Object.freeze(
			rows.map((row) =>
				Object.freeze({
					...rowToPreference(row),
					evidence: Object.freeze([]),
				}),
			),
		);
	});
}

export function getMemoryOverview(input?: InspectDbInput): InspectMemoryOverview {
	return withInspectDb(
		input,
		Object.freeze({
			stats: Object.freeze({
				totalObservations: 0,
				totalProjects: 0,
				totalPreferences: 0,
				storageSizeKb: 0,
				observationsByType: Object.freeze(
					Object.fromEntries(OBSERVATION_TYPES.map((type) => [type, 0])),
				),
			}),
			recentObservations: Object.freeze([]),
			preferences: Object.freeze([]),
		}),
		(db, dbPath) => {
			const totalObservations = (
				db.query("SELECT COUNT(*) as cnt FROM observations").get() as CountRow
			).cnt;
			const totalProjects = (db.query("SELECT COUNT(*) as cnt FROM projects").get() as CountRow)
				.cnt;
			const totalPreferences = (
				db
					.query(
						tableExists(db, "preference_records")
							? "SELECT COUNT(*) as cnt FROM preference_records"
							: "SELECT COUNT(*) as cnt FROM preferences",
					)
					.get() as CountRow
			).cnt;

			const typeCounts = Object.fromEntries(OBSERVATION_TYPES.map((type) => [type, 0]));
			const typeRows = db
				.query("SELECT type, COUNT(*) as cnt FROM observations GROUP BY type")
				.all() as TypeCountRow[];
			for (const row of typeRows) {
				typeCounts[row.type] = row.cnt;
			}

			const recentRows = db
				.query(
					`SELECT o.id, o.project_id, p.name AS project_name, o.session_id, o.type, o.summary, o.confidence, o.created_at
					 FROM observations o
					 LEFT JOIN projects p ON p.id = o.project_id
					 ORDER BY o.created_at DESC, o.id DESC
					 LIMIT 10`,
				)
				.all() as ObservationRow[];

			const storageSizeKb =
				dbPath === null
					? 0
					: (() => {
							try {
								return Math.round(statSync(dbPath).size / 1024);
							} catch {
								return 0;
							}
						})();

			return Object.freeze({
				stats: Object.freeze({
					totalObservations,
					totalProjects,
					totalPreferences,
					storageSizeKb,
					observationsByType: Object.freeze(typeCounts),
				}),
				recentObservations: Object.freeze(
					recentRows.map((row) =>
						Object.freeze({
							id: row.id,
							projectId: row.project_id,
							projectName: row.project_name,
							sessionId: row.session_id,
							type: row.type,
							summary: row.summary,
							confidence: row.confidence,
							createdAt: row.created_at,
						}),
					),
				),
				preferences: listPreferences(db),
			});
		},
	);
}
