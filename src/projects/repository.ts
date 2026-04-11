import type { Database } from "bun:sqlite";
import { getMemoryDb } from "../memory/database";
import {
	gitFingerprintInputSchema,
	projectGitFingerprintSchema,
	projectPathRecordSchema,
	projectRecordSchema,
} from "./schemas";
import type {
	GitFingerprintInput,
	ProjectGitFingerprint,
	ProjectPathRecord,
	ProjectRecord,
} from "./types";

interface ProjectRow {
	readonly id: string;
	readonly path: string;
	readonly name: string;
	readonly first_seen_at: string | null;
	readonly last_updated: string;
}

interface ProjectPathRow {
	readonly project_id: string;
	readonly path: string;
	readonly first_seen_at: string;
	readonly last_updated: string;
	readonly is_current: number;
}

interface ProjectFingerprintRow {
	readonly project_id: string;
	readonly normalized_remote_url: string;
	readonly default_branch: string | null;
	readonly first_seen_at: string;
	readonly last_updated: string;
}

/**
 * Project-scoped callers must pass their project kernel DB explicitly.
 * Falling back to the global memory DB is reserved for cross-project discovery
 * and legacy compatibility callers that intentionally operate globally.
 */
function resolveProjectRegistryDb(db?: Database): Database {
	return db ?? getMemoryDb();
}

function withWriteTransaction<T>(db: Database, callback: () => T): T {
	const row = db.query("PRAGMA transaction_state").get() as {
		transaction_state?: string;
	} | null;
	const isAlreadyInTransaction = row?.transaction_state === "TRANSACTION";
	if (isAlreadyInTransaction) {
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

function rowToProject(row: ProjectRow): ProjectRecord {
	return projectRecordSchema.parse({
		id: row.id,
		path: row.path,
		name: row.name,
		firstSeenAt: row.first_seen_at ?? row.last_updated,
		lastUpdated: row.last_updated,
	});
}

function rowToProjectPath(row: ProjectPathRow): ProjectPathRecord {
	return projectPathRecordSchema.parse({
		projectId: row.project_id,
		path: row.path,
		firstSeenAt: row.first_seen_at,
		lastUpdated: row.last_updated,
		isCurrent: row.is_current === 1,
	});
}

function rowToProjectFingerprint(
	row: ProjectFingerprintRow,
): ProjectGitFingerprint {
	return projectGitFingerprintSchema.parse({
		projectId: row.project_id,
		normalizedRemoteUrl: row.normalized_remote_url,
		defaultBranch: row.default_branch,
		firstSeenAt: row.first_seen_at,
		lastUpdated: row.last_updated,
	});
}

export function upsertProjectRecord(
	project: ProjectRecord,
	db?: Database,
): ProjectRecord {
	const validated = projectRecordSchema.parse(project);
	const d = resolveProjectRegistryDb(db);
	const firstSeenAt = validated.firstSeenAt ?? validated.lastUpdated;

	withWriteTransaction(d, () => {
		d.run(
			`INSERT INTO projects (id, path, name, first_seen_at, last_updated)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
				path = excluded.path,
				name = excluded.name,
				first_seen_at = COALESCE(projects.first_seen_at, excluded.first_seen_at),
				last_updated = excluded.last_updated`,
			[
				validated.id,
				validated.path,
				validated.name,
				firstSeenAt,
				validated.lastUpdated,
			],
		);

		d.run(
			"UPDATE project_paths SET is_current = 0, last_updated = ? WHERE project_id = ?",
			[validated.lastUpdated, validated.id],
		);
		d.run(
			`INSERT INTO project_paths (project_id, path, first_seen_at, last_updated, is_current)
			 VALUES (?, ?, ?, ?, 1)
			 ON CONFLICT(project_id, path) DO UPDATE SET
				last_updated = excluded.last_updated,
				is_current = 1`,
			[validated.id, validated.path, firstSeenAt, validated.lastUpdated],
		);
	});

	return projectRecordSchema.parse({
		...validated,
		firstSeenAt,
	});
}

export function getProjectById(
	projectId: string,
	db?: Database,
): ProjectRecord | null {
	const d = resolveProjectRegistryDb(db);
	const row = d
		.query("SELECT * FROM projects WHERE id = ?")
		.get(projectId) as ProjectRow | null;
	return row ? rowToProject(row) : null;
}

export function getProjectByCurrentPath(
	path: string,
	db?: Database,
): ProjectRecord | null {
	const d = resolveProjectRegistryDb(db);
	const row = d
		.query("SELECT * FROM projects WHERE path = ?")
		.get(path) as ProjectRow | null;
	return row ? rowToProject(row) : null;
}

export function getProjectByAnyPath(
	path: string,
	db?: Database,
): ProjectRecord | null {
	const current = getProjectByCurrentPath(path, db);
	if (current !== null) {
		return current;
	}

	const d = resolveProjectRegistryDb(db);
	const row = d
		.query(
			`SELECT p.*
			 FROM project_paths pp
			 JOIN projects p ON p.id = pp.project_id
			 WHERE pp.path = ?
			 ORDER BY pp.is_current DESC, pp.last_updated DESC
			 LIMIT 1`,
		)
		.get(path) as ProjectRow | null;
	return row ? rowToProject(row) : null;
}

export function listProjectPaths(
	projectId: string,
	db?: Database,
): readonly ProjectPathRecord[] {
	const d = resolveProjectRegistryDb(db);
	const rows = d
		.query(
			`SELECT *
			 FROM project_paths
			 WHERE project_id = ?
			 ORDER BY is_current DESC, last_updated DESC, path ASC`,
		)
		.all(projectId) as ProjectPathRow[];
	return Object.freeze(rows.map(rowToProjectPath));
}

export function setProjectCurrentPath(
	projectId: string,
	path: string,
	name: string,
	seenAt: string,
	db?: Database,
): ProjectRecord {
	const d = resolveProjectRegistryDb(db);
	const existing = getProjectById(projectId, d);
	if (existing === null) {
		throw new Error(`Unknown project id: ${projectId}`);
	}

	const next = projectRecordSchema.parse({
		id: existing.id,
		path,
		name,
		firstSeenAt: existing.firstSeenAt,
		lastUpdated: seenAt,
	});
	return upsertProjectRecord(next, d);
}

export function upsertProjectGitFingerprint(
	projectId: string,
	fingerprint: GitFingerprintInput,
	seenAt: string,
	db?: Database,
): ProjectGitFingerprint {
	const validated = gitFingerprintInputSchema.parse(fingerprint);
	const d = resolveProjectRegistryDb(db);

	d.run(
		`INSERT INTO project_git_fingerprints (
			project_id,
			normalized_remote_url,
			default_branch,
			first_seen_at,
			last_updated
		) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(project_id, normalized_remote_url) DO UPDATE SET
			default_branch = excluded.default_branch,
			last_updated = excluded.last_updated`,
		[
			projectId,
			validated.normalizedRemoteUrl,
			validated.defaultBranch,
			seenAt,
			seenAt,
		],
	);

	return projectGitFingerprintSchema.parse({
		projectId,
		normalizedRemoteUrl: validated.normalizedRemoteUrl,
		defaultBranch: validated.defaultBranch,
		firstSeenAt: seenAt,
		lastUpdated: seenAt,
	});
}

export function getProjectsByGitFingerprint(
	normalizedRemoteUrl: string,
	db?: Database,
): readonly ProjectRecord[] {
	const d = resolveProjectRegistryDb(db);
	const rows = d
		.query(
			`SELECT DISTINCT p.*
			 FROM project_git_fingerprints pgf
			 JOIN projects p ON p.id = pgf.project_id
			 WHERE pgf.normalized_remote_url = ?
			 ORDER BY p.last_updated DESC, p.id DESC`,
		)
		.all(normalizedRemoteUrl) as ProjectRow[];
	return Object.freeze(rows.map(rowToProject));
}

export function listProjectGitFingerprints(
	projectId: string,
	db?: Database,
): readonly ProjectGitFingerprint[] {
	const d = resolveProjectRegistryDb(db);
	const rows = d
		.query(
			`SELECT *
			 FROM project_git_fingerprints
			 WHERE project_id = ?
			 ORDER BY last_updated DESC, normalized_remote_url ASC`,
		)
		.all(projectId) as ProjectFingerprintRow[];
	return Object.freeze(rows.map(rowToProjectFingerprint));
}
