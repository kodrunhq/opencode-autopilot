import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	KERNEL_DB_FILE,
	openKernelDb,
	openProjectKernelDb,
	resolveKernelDbPathFromProject,
} from "../../src/kernel/database";
import { reconcileProjectIds, runKernelMigrations } from "../../src/kernel/migrations";
import { KERNEL_SCHEMA_VERSION } from "../../src/kernel/schema";
import { computeDeterministicProjectId } from "../../src/projects/resolve";

const PROJECT_SCOPED_TABLES = Object.freeze([
	"pipeline_runs",
	"forensic_events",
	"active_review_state",
	"project_review_memory",
	"project_lesson_memory",
	"project_paths",
	"project_git_fingerprints",
] as const);

const FIXED_TIMESTAMP = "2026-04-12T00:00:00.000Z";

function insertProjectFixture(
	db: Database,
	options: {
		readonly projectId: string;
		readonly projectPath: string;
		readonly runId: string;
		readonly fingerprint?: {
			readonly normalizedRemoteUrl: string;
			readonly defaultBranch: string | null;
		};
	},
): void {
	db.run(
		"INSERT INTO projects (id, path, name, first_seen_at, last_updated) VALUES (?, ?, ?, ?, ?)",
		[options.projectId, options.projectPath, "forensic-project", FIXED_TIMESTAMP, FIXED_TIMESTAMP],
	);
	db.run(
		`INSERT INTO project_paths (project_id, path, first_seen_at, last_updated, is_current)
		 VALUES (?, ?, ?, ?, 1)`,
		[options.projectId, options.projectPath, FIXED_TIMESTAMP, FIXED_TIMESTAMP],
	);
	if (options.fingerprint) {
		db.run(
			`INSERT INTO project_git_fingerprints (
				project_id,
				normalized_remote_url,
				default_branch,
				first_seen_at,
				last_updated
			) VALUES (?, ?, ?, ?, ?)`,
			[
				options.projectId,
				options.fingerprint.normalizedRemoteUrl,
				options.fingerprint.defaultBranch,
				FIXED_TIMESTAMP,
				FIXED_TIMESTAMP,
			],
		);
	}
	db.run(
		`INSERT INTO pipeline_runs (
			project_id,
			run_id,
			schema_version,
			status,
			current_phase,
			idea,
			state_revision,
			started_at,
			last_updated_at,
			failure_phase,
			failure_agent,
			failure_message,
			last_successful_phase,
			state_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			options.projectId,
			options.runId,
			2,
			"IN_PROGRESS",
			"RECON",
			"forensic-hardening",
			0,
			FIXED_TIMESTAMP,
			FIXED_TIMESTAMP,
			null,
			null,
			null,
			null,
			JSON.stringify({ idea: "forensic-hardening" }),
		],
	);
	db.run(
		`INSERT INTO active_review_state (
			project_id,
			stage,
			scope,
			started_at,
			saved_at,
			state_json
		) VALUES (?, ?, ?, ?, ?, ?)`,
		[options.projectId, 1, "project", FIXED_TIMESTAMP, FIXED_TIMESTAMP, JSON.stringify({})],
	);
	db.run(
		"INSERT INTO project_review_memory (project_id, schema_version, last_reviewed_at, state_json) VALUES (?, ?, ?, ?)",
		[options.projectId, 1, FIXED_TIMESTAMP, JSON.stringify({})],
	);
	db.run(
		"INSERT INTO project_lesson_memory (project_id, schema_version, last_updated_at, state_json) VALUES (?, ?, ?, ?)",
		[options.projectId, 1, FIXED_TIMESTAMP, JSON.stringify({})],
	);
	db.run(
		`INSERT INTO forensic_events (
			project_id,
			schema_version,
			timestamp,
			project_root,
			domain,
			run_id,
			session_id,
			parent_session_id,
			phase,
			dispatch_id,
			task_id,
			agent,
			type,
			code,
			message,
			payload_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			options.projectId,
			1,
			FIXED_TIMESTAMP,
			options.projectPath,
			"kernel",
			options.runId,
			"session-forensic",
			null,
			"RECON",
			"dispatch-forensic",
			null,
			"oc-researcher",
			"dispatch.issued",
			null,
			null,
			JSON.stringify({ projectId: options.projectId }),
		],
	);
}

function collectProjectIdsByTable(
	db: Database,
	tableName: (typeof PROJECT_SCOPED_TABLES)[number],
): readonly string[] {
	const rows = db
		.query(`SELECT DISTINCT project_id AS projectId FROM ${tableName} ORDER BY project_id ASC`)
		.all() as Array<{ projectId: string }>;
	return rows.map((row) => row.projectId);
}

function snapshotProjectScopedIds(
	db: Database,
): Record<(typeof PROJECT_SCOPED_TABLES)[number] | "projects", readonly string[]> {
	return {
		projects: (
			db.query("SELECT id FROM projects ORDER BY id ASC").all() as Array<{ id: string }>
		).map((row) => row.id),
		pipeline_runs: collectProjectIdsByTable(db, "pipeline_runs"),
		forensic_events: collectProjectIdsByTable(db, "forensic_events"),
		active_review_state: collectProjectIdsByTable(db, "active_review_state"),
		project_review_memory: collectProjectIdsByTable(db, "project_review_memory"),
		project_lesson_memory: collectProjectIdsByTable(db, "project_lesson_memory"),
		project_paths: collectProjectIdsByTable(db, "project_paths"),
		project_git_fingerprints: collectProjectIdsByTable(db, "project_git_fingerprints"),
	};
}

function withForeignKeysDisabled<T>(db: Database, callback: () => T): T {
	db.run("PRAGMA foreign_keys=OFF");
	try {
		return callback();
	} finally {
		db.run("PRAGMA foreign_keys=ON");
	}
}

describe("kernel forensic hardening", () => {
	let projectRoot: string;
	let artifactDir: string;

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "kernel-forensic-"));
		artifactDir = join(projectRoot, ".opencode-autopilot");
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	test("reconcileProjectIds skips deterministic ids and rewrites legacy ids across child tables", () => {
		const db = openKernelDb(artifactDir);
		try {
			withForeignKeysDisabled(db, () => {
				const deterministicPath = join(projectRoot, "deterministic-project");
				const deterministicFingerprint = {
					normalizedRemoteUrl: "github.com/example/already-deterministic",
					defaultBranch: "main",
				};
				const deterministicId = computeDeterministicProjectId(
					deterministicPath,
					deterministicFingerprint,
				);
				insertProjectFixture(db, {
					projectId: deterministicId,
					projectPath: deterministicPath,
					runId: "run_deterministic",
					fingerprint: deterministicFingerprint,
				});

				const legacyPath = join(projectRoot, "legacy-project");
				const fingerprint = {
					normalizedRemoteUrl: "github.com/example/forensic-hardening",
					defaultBranch: "main",
				};
				const legacyId = "legacy-project-id";
				const reconciledId = computeDeterministicProjectId(legacyPath, fingerprint);
				insertProjectFixture(db, {
					projectId: legacyId,
					projectPath: legacyPath,
					runId: "run_legacy",
					fingerprint,
				});

				reconcileProjectIds(db);

				const expectedIds = [deterministicId, reconciledId].sort();
				expect(snapshotProjectScopedIds(db)).toEqual({
					projects: expectedIds,
					pipeline_runs: expectedIds,
					forensic_events: expectedIds,
					active_review_state: expectedIds,
					project_review_memory: expectedIds,
					project_lesson_memory: expectedIds,
					project_paths: expectedIds,
					project_git_fingerprints: expectedIds,
				});
				const rewrittenRun = db
					.query("SELECT project_id AS projectId FROM pipeline_runs WHERE run_id = ?")
					.get("run_legacy") as { projectId: string };
				expect(rewrittenRun.projectId).toBe(reconciledId);
			});
		} finally {
			db.close();
		}
	});

	test("reconcileProjectIds is idempotent after legacy ids are rewritten", () => {
		const db = openKernelDb(artifactDir);
		try {
			withForeignKeysDisabled(db, () => {
				const legacyPath = join(projectRoot, "legacy-idempotent-project");
				insertProjectFixture(db, {
					projectId: "legacy-idempotent-id",
					projectPath: legacyPath,
					runId: "run_idempotent",
				});

				reconcileProjectIds(db);
				const firstSnapshot = snapshotProjectScopedIds(db);

				reconcileProjectIds(db);

				expect(snapshotProjectScopedIds(db)).toEqual(firstSnapshot);
			});
		} finally {
			db.close();
		}
	});

	test("runKernelMigrations triggers project reconciliation on schema version bump", () => {
		const db = openKernelDb(artifactDir);
		try {
			withForeignKeysDisabled(db, () => {
				const legacyPath = join(projectRoot, "schema-bump-project");
				const legacyId = "legacy-schema-version-project";
				const expectedId = computeDeterministicProjectId(legacyPath, null);
				insertProjectFixture(db, {
					projectId: legacyId,
					projectPath: legacyPath,
					runId: "run_schema_bump",
				});
				db.run(`PRAGMA user_version = ${KERNEL_SCHEMA_VERSION - 1}`);

				runKernelMigrations(db);

				const version = db.query("PRAGMA user_version").get() as { user_version: number };
				expect(version.user_version).toBe(KERNEL_SCHEMA_VERSION);
				expect(snapshotProjectScopedIds(db).projects).toEqual([expectedId]);
				expect(collectProjectIdsByTable(db, "pipeline_runs")).toEqual([expectedId]);
			});
		} finally {
			db.close();
		}
	});

	test("openProjectKernelDb migrates a legacy root kernel database into the artifact directory", () => {
		const legacyPath = join(projectRoot, KERNEL_DB_FILE);
		const legacyDb = openKernelDb(legacyPath);
		legacyDb.run("CREATE TABLE legacy_marker (value TEXT NOT NULL)");
		legacyDb.run("INSERT INTO legacy_marker (value) VALUES (?)", ["preserved"]);
		legacyDb.close();

		expect(existsSync(legacyPath)).toBe(true);

		const resolution = resolveKernelDbPathFromProject(projectRoot, { migrateLegacy: true });
		const migratedDb = openProjectKernelDb(projectRoot);
		try {
			const marker = migratedDb.query("SELECT value FROM legacy_marker LIMIT 1").get() as {
				value: string;
			};

			expect(resolution.kind).toBe("migrated");
			expect(resolution.path).toBe(join(projectRoot, ".opencode-autopilot", KERNEL_DB_FILE));
			expect(marker.value).toBe("preserved");
			expect(existsSync(legacyPath)).toBe(false);
			expect(existsSync(resolution.path)).toBe(true);
		} finally {
			migratedDb.close();
		}
	});
});
