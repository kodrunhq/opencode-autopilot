import type { Database } from "bun:sqlite";
import { runProjectRegistryMigrations } from "../projects/database";
import { KERNEL_SCHEMA_STATEMENTS, KERNEL_SCHEMA_VERSION } from "./schema";

function columnExists(database: Database, tableName: string, columnName: string): boolean {
	const columns = database.query(`PRAGMA table_info(${tableName})`).all() as Array<{
		name?: string;
	}>;
	return columns.some((column) => column.name === columnName);
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

export function runKernelMigrations(database: Database): void {
	const row = database.query("PRAGMA user_version").get() as { user_version?: number } | null;
	const currentVersion = row?.user_version ?? 0;

	runProjectRegistryMigrations(database);

	for (const statement of KERNEL_SCHEMA_STATEMENTS) {
		database.run(statement);
	}

	backfillProjectAwareColumns(database);

	if (currentVersion < KERNEL_SCHEMA_VERSION) {
		database.run(`PRAGMA user_version = ${KERNEL_SCHEMA_VERSION}`);
	}
}
