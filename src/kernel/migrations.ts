import type { Database } from "bun:sqlite";
import { runProjectRegistryMigrations } from "../projects/database";
import { KERNEL_SCHEMA_STATEMENTS, KERNEL_SCHEMA_VERSION } from "./schema";

function columnExists(database: Database, tableName: string, columnName: string): boolean {
	const columns = database.query(`PRAGMA table_info(${tableName})`).all() as Array<{
		name?: string;
	}>;
	return columns.some((column) => column.name === columnName);
}

function tableExists(database: Database, tableName: string): boolean {
	const row = database
		.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
		.get(tableName) as { name?: string } | null;
	return row?.name === tableName;
}

function backfillProjectAwareColumns(database: Database): void {
	if (!columnExists(database, "pipeline_runs", "project_id")) {
		database.run("ALTER TABLE pipeline_runs ADD COLUMN project_id TEXT");
		database.run("UPDATE pipeline_runs SET project_id = 'legacy-project' WHERE project_id IS NULL");
	}

	if (!columnExists(database, "active_review_state", "project_id")) {
		database.run("ALTER TABLE active_review_state ADD COLUMN project_id TEXT");
		database.run(
			"UPDATE active_review_state SET project_id = 'legacy-project' WHERE project_id IS NULL",
		);
	}

	if (!columnExists(database, "project_review_memory", "project_id")) {
		database.run("ALTER TABLE project_review_memory ADD COLUMN project_id TEXT");
		database.run(
			"UPDATE project_review_memory SET project_id = 'legacy-project' WHERE project_id IS NULL",
		);
	}

	if (!columnExists(database, "project_lesson_memory", "project_id")) {
		database.run("ALTER TABLE project_lesson_memory ADD COLUMN project_id TEXT");
		database.run(
			"UPDATE project_lesson_memory SET project_id = 'legacy-project' WHERE project_id IS NULL",
		);
	}

	if (!columnExists(database, "forensic_events", "project_id")) {
		database.run("ALTER TABLE forensic_events ADD COLUMN project_id TEXT");
		database.run(
			"UPDATE forensic_events SET project_id = 'legacy-project' WHERE project_id IS NULL",
		);
	}
}

function columnType(database: Database, tableName: string, columnName: string): string | null {
	const columns = database.query(`PRAGMA table_info(${tableName})`).all() as Array<{
		name?: string;
		type?: string;
	}>;
	const col = columns.find((c) => c.name === columnName);
	return col?.type?.toUpperCase() ?? null;
}

function getTableColumns(database: Database, tableName: string): readonly string[] {
	const columns = database.query(`PRAGMA table_info(${tableName})`).all() as Array<{
		name?: string;
	}>;
	return columns.map((c) => c.name ?? "").filter(Boolean);
}

const REBUILD_DDLS: Readonly<Record<string, string>> = Object.freeze({
	run_tasks: `CREATE TABLE _rebuild_run_tasks (
		run_id TEXT NOT NULL,
		task_id TEXT NOT NULL,
		title TEXT NOT NULL,
		status TEXT NOT NULL,
		wave INTEGER NOT NULL,
		depends_on_json TEXT NOT NULL,
		attempt INTEGER NOT NULL,
		strike INTEGER NOT NULL,
		PRIMARY KEY (run_id, task_id),
		FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE
	)`,
	run_pending_dispatches: `CREATE TABLE _rebuild_run_pending_dispatches (
		run_id TEXT NOT NULL,
		dispatch_id TEXT NOT NULL,
		phase TEXT NOT NULL,
		agent TEXT NOT NULL,
		issued_at TEXT NOT NULL,
		result_kind TEXT NOT NULL,
		task_id TEXT,
		session_id TEXT,
		PRIMARY KEY (run_id, dispatch_id),
		FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE
	)`,
	forensic_events: `CREATE TABLE _rebuild_forensic_events (
		event_id INTEGER PRIMARY KEY AUTOINCREMENT,
		project_id TEXT NOT NULL,
		schema_version INTEGER NOT NULL,
		timestamp TEXT NOT NULL,
		project_root TEXT NOT NULL,
		domain TEXT NOT NULL,
		run_id TEXT,
		session_id TEXT,
		parent_session_id TEXT,
		phase TEXT,
		dispatch_id TEXT,
		task_id TEXT,
		agent TEXT,
		type TEXT NOT NULL,
		code TEXT,
		message TEXT,
		payload_json TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	)`,
});

function rebuildTableWithTextTaskId(database: Database, tableName: string): void {
	if (!tableExists(database, tableName)) return;
	const currentType = columnType(database, tableName, "task_id");
	if (currentType === null || currentType === "TEXT") return;

	const ddl = REBUILD_DDLS[tableName];
	if (!ddl) return;

	const columns = getTableColumns(database, tableName);
	if (columns.length === 0) return;

	const rebuildTable = `_rebuild_${tableName}`;
	const columnList = columns.join(", ");
	const castColumns = columns
		.map((col) => (col === "task_id" ? "CAST(task_id AS TEXT) AS task_id" : col))
		.join(", ");

	database.run(`DROP TABLE IF EXISTS ${rebuildTable}`);
	database.run(ddl);
	database.run(
		`INSERT INTO ${rebuildTable} (${columnList}) SELECT ${castColumns} FROM ${tableName}`,
	);
	database.run(`DROP TABLE ${tableName}`);
	database.run(`ALTER TABLE ${rebuildTable} RENAME TO ${tableName}`);
}

function migrateTaskIdToText(database: Database): void {
	rebuildTableWithTextTaskId(database, "run_tasks");
	rebuildTableWithTextTaskId(database, "run_pending_dispatches");
	rebuildTableWithTextTaskId(database, "forensic_events");
}

function ensureSessionIdOnPendingDispatches(database: Database): void {
	if (!tableExists(database, "run_pending_dispatches")) return;
	if (columnExists(database, "run_pending_dispatches", "session_id")) return;

	const rebuildTable = `_rebuild_run_pending_dispatches`;
	database.run(`DROP TABLE IF EXISTS ${rebuildTable}`);
	database.run(REBUILD_DDLS.run_pending_dispatches);
	database.run(
		`INSERT INTO ${rebuildTable} (
			run_id,
			dispatch_id,
			phase,
			agent,
			issued_at,
			result_kind,
			task_id,
			session_id
		)
		SELECT
			run_id,
			dispatch_id,
			phase,
			agent,
			issued_at,
			result_kind,
			CAST(task_id AS TEXT) AS task_id,
			NULL AS session_id
		FROM run_pending_dispatches`,
	);
	database.run("DROP TABLE run_pending_dispatches");
	database.run(`ALTER TABLE ${rebuildTable} RENAME TO run_pending_dispatches`);
}

function backfillBackgroundTaskColumns(database: Database): void {
	if (!tableExists(database, "background_tasks")) {
		return;
	}

	const columnDefinitions = Object.freeze([
		{ name: "category", ddl: "ALTER TABLE background_tasks ADD COLUMN category TEXT" },
		{ name: "result", ddl: "ALTER TABLE background_tasks ADD COLUMN result TEXT" },
		{ name: "error", ddl: "ALTER TABLE background_tasks ADD COLUMN error TEXT" },
		{ name: "agent", ddl: "ALTER TABLE background_tasks ADD COLUMN agent TEXT" },
		{ name: "model", ddl: "ALTER TABLE background_tasks ADD COLUMN model TEXT" },
		{
			name: "priority",
			ddl: "ALTER TABLE background_tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 50",
		},
		{ name: "created_at", ddl: "ALTER TABLE background_tasks ADD COLUMN created_at TEXT" },
		{ name: "updated_at", ddl: "ALTER TABLE background_tasks ADD COLUMN updated_at TEXT" },
		{ name: "started_at", ddl: "ALTER TABLE background_tasks ADD COLUMN started_at TEXT" },
		{ name: "completed_at", ddl: "ALTER TABLE background_tasks ADD COLUMN completed_at TEXT" },
	]);

	for (const column of columnDefinitions) {
		if (!columnExists(database, "background_tasks", column.name)) {
			database.run(column.ddl);
		}
	}

	const now = new Date().toISOString();
	if (columnExists(database, "background_tasks", "created_at")) {
		database.run(
			"UPDATE background_tasks SET created_at = COALESCE(created_at, ?) WHERE created_at IS NULL",
			[now],
		);
	}
	if (columnExists(database, "background_tasks", "updated_at")) {
		database.run(
			"UPDATE background_tasks SET updated_at = COALESCE(updated_at, created_at, ?) WHERE updated_at IS NULL",
			[now],
		);
	}
}

export function runKernelMigrations(database: Database): void {
	const row = database.query("PRAGMA user_version").get() as { user_version?: number } | null;
	const currentVersion = row?.user_version ?? 0;

	runProjectRegistryMigrations(database);

	for (const statement of KERNEL_SCHEMA_STATEMENTS) {
		database.run(statement);
	}

	backfillProjectAwareColumns(database);
	migrateTaskIdToText(database);
	ensureSessionIdOnPendingDispatches(database);
	backfillBackgroundTaskColumns(database);

	if (currentVersion < KERNEL_SCHEMA_VERSION) {
		database.run(`PRAGMA user_version = ${KERNEL_SCHEMA_VERSION}`);
	}
}
