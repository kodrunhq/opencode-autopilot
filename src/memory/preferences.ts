/**
 * Preference repository operations.
 * Handles preference records with evidence tracking and pruning.
 */

import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { systemTimeProvider, type TimeProvider } from "../scoring/time-provider";
import { getMemoryDb } from "./database";
import { preferenceEvidenceSchema, preferenceRecordSchema, preferenceSchema } from "./schemas";
import type { Preference, PreferenceEvidence, PreferenceRecord } from "./types";

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

function isPreferenceStatusMatch(record: PreferenceRecord, status: PreferencePruneStatus): boolean {
	if (status === "any") {
		return true;
	}
	if (status === "unconfirmed") {
		return record.status !== "confirmed";
	}
	return record.status === status;
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

function selectPrunablePreferenceRecords(
	options: PreferencePruneOptions,
	db: Database,
	timeProvider: TimeProvider = systemTimeProvider,
): readonly PreferenceRecord[] {
	const cutoff = new Date(
		timeProvider.now() - Math.max(1, options.olderThanDays) * 24 * 60 * 60 * 1000,
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

function getAllPreferencesLegacy(db: Database): readonly Preference[] {
	const rows = db
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
		return getAllPreferencesLegacy(d).map((preference) =>
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
	timeProvider: TimeProvider = systemTimeProvider,
): PreferenceMutationResult {
	const d = resolveDb(db);
	const records = selectPrunablePreferenceRecords(options, d, timeProvider);
	return deletePreferenceRecordsByIds(
		records.map((record) => record.id),
		d,
	);
}

export function prunePreferenceEvidence(
	options: PreferenceEvidencePruneOptions,
	db?: Database,
	timeProvider: TimeProvider = systemTimeProvider,
): PreferenceMutationResult {
	const d = resolveDb(db);
	if (!tableExists(d, "preference_evidence") || !tableExists(d, "preference_records")) {
		return Object.freeze({ deletedPreferences: 0, deletedEvidence: 0 });
	}

	const cutoff = new Date(
		timeProvider.now() - Math.max(1, options.olderThanDays) * 24 * 60 * 60 * 1000,
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

export function getAllPreferences(db?: Database): readonly Preference[] {
	const d = resolveDb(db);
	if (!tableExists(d, "preference_records")) {
		return getAllPreferencesLegacy(d);
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
