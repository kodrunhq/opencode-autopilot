export const BACKGROUND_TASKS_TABLE_STATEMENT = `CREATE TABLE IF NOT EXISTS background_tasks (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	description TEXT NOT NULL,
	category TEXT,
	status TEXT NOT NULL DEFAULT 'pending',
	result TEXT,
	error TEXT,
	agent TEXT,
	model TEXT,
	priority INTEGER NOT NULL DEFAULT 50,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	started_at TEXT,
	completed_at TEXT
)`;

export const BACKGROUND_TASKS_INDEX_STATEMENT =
	"CREATE INDEX IF NOT EXISTS idx_background_tasks_status_created_at ON background_tasks(status, created_at)";

export const BACKGROUND_TASKS_SCHEMA_STATEMENTS: readonly string[] = Object.freeze([
	BACKGROUND_TASKS_TABLE_STATEMENT,
	BACKGROUND_TASKS_INDEX_STATEMENT,
]);
