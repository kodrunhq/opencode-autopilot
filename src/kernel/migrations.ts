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

function migrateTaskIdToText(database: Database): void {
	const tablesToMigrate = Object.freeze([
		{ table: "run_tasks", nullable: false },
		{ table: "run_pending_dispatches", nullable: true },
		{ table: "forensic_events", nullable: true },
	]);

	for (const { table, nullable } of tablesToMigrate) {
		if (!tableExists(database, table)) {
			continue;
		}
		const currentType = columnType(database, table, "task_id");
		if (currentType === null || currentType === "TEXT") {
			continue;
		}
		// SQLite does not support ALTER COLUMN, so we cast in-place.
		// INTEGER values stored in a TEXT column are valid — SQLite is
		// dynamically typed. We backfill by converting existing integer
		// values to their text representation.
		if (nullable) {
			database.run(
				`UPDATE ${table} SET task_id = CAST(task_id AS TEXT) WHERE task_id IS NOT NULL AND typeof(task_id) != 'text'`,
			);
		} else {
			database.run(
				`UPDATE ${table} SET task_id = CAST(task_id AS TEXT) WHERE typeof(task_id) != 'text'`,
			);
		}
	}
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
	backfillBackgroundTaskColumns(database);

	if (currentVersion < KERNEL_SCHEMA_VERSION) {
		database.run(`PRAGMA user_version = ${KERNEL_SCHEMA_VERSION}`);
	}
}
