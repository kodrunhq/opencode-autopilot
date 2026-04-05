import { BACKGROUND_TASKS_SCHEMA_STATEMENTS } from "../background/schema";

export const KERNEL_SCHEMA_VERSION = 3;

export const KERNEL_SCHEMA_STATEMENTS: readonly string[] = Object.freeze([
	`CREATE TABLE IF NOT EXISTS pipeline_runs (
		project_id TEXT NOT NULL,
		run_id TEXT PRIMARY KEY,
		schema_version INTEGER NOT NULL,
		status TEXT NOT NULL,
		current_phase TEXT,
		idea TEXT NOT NULL,
		state_revision INTEGER NOT NULL,
		started_at TEXT NOT NULL,
		last_updated_at TEXT NOT NULL,
		failure_phase TEXT,
		failure_agent TEXT,
		failure_message TEXT,
		last_successful_phase TEXT,
		state_json TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	)`,
	`CREATE INDEX IF NOT EXISTS idx_pipeline_runs_project_updated_at ON pipeline_runs(project_id, last_updated_at DESC, run_id DESC)`,
	`CREATE TABLE IF NOT EXISTS run_phases (
		run_id TEXT NOT NULL,
		phase_name TEXT NOT NULL,
		status TEXT NOT NULL,
		completed_at TEXT,
		confidence TEXT,
		PRIMARY KEY (run_id, phase_name),
		FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS run_tasks (
		run_id TEXT NOT NULL,
		task_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		status TEXT NOT NULL,
		wave INTEGER NOT NULL,
		depends_on_json TEXT NOT NULL,
		attempt INTEGER NOT NULL,
		strike INTEGER NOT NULL,
		PRIMARY KEY (run_id, task_id),
		FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS run_pending_dispatches (
		run_id TEXT NOT NULL,
		dispatch_id TEXT NOT NULL,
		phase TEXT NOT NULL,
		agent TEXT NOT NULL,
		issued_at TEXT NOT NULL,
		result_kind TEXT NOT NULL,
		task_id INTEGER,
		PRIMARY KEY (run_id, dispatch_id),
		FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS run_processed_results (
		run_id TEXT NOT NULL,
		result_id TEXT NOT NULL,
		PRIMARY KEY (run_id, result_id),
		FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS active_review_state (
		project_id TEXT PRIMARY KEY,
		stage INTEGER NOT NULL,
		scope TEXT NOT NULL,
		started_at TEXT NOT NULL,
		saved_at TEXT NOT NULL,
		state_json TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS project_review_memory (
		project_id TEXT PRIMARY KEY,
		schema_version INTEGER NOT NULL,
		last_reviewed_at TEXT,
		state_json TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS project_lesson_memory (
		project_id TEXT PRIMARY KEY,
		schema_version INTEGER NOT NULL,
		last_updated_at TEXT,
		state_json TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS project_lessons (
		lesson_id INTEGER PRIMARY KEY AUTOINCREMENT,
		project_id TEXT NOT NULL,
		content TEXT NOT NULL,
		domain TEXT NOT NULL,
		extracted_at TEXT NOT NULL,
		source_phase TEXT NOT NULL,
		last_updated_at TEXT,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
		UNIQUE(project_id, extracted_at, domain, source_phase, content)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_project_lessons_project_extracted_at ON project_lessons(project_id, extracted_at DESC, lesson_id DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_project_lessons_domain ON project_lessons(project_id, domain, extracted_at DESC, lesson_id DESC)`,
	`CREATE TABLE IF NOT EXISTS forensic_events (
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
		task_id INTEGER,
		agent TEXT,
		type TEXT NOT NULL,
		code TEXT,
		message TEXT,
		payload_json TEXT NOT NULL,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
	)`,
	`CREATE INDEX IF NOT EXISTS idx_forensic_events_timestamp ON forensic_events(timestamp, event_id)`,
	`CREATE INDEX IF NOT EXISTS idx_forensic_events_project ON forensic_events(project_id, timestamp, event_id)`,
	`CREATE INDEX IF NOT EXISTS idx_forensic_events_session ON forensic_events(session_id, timestamp, event_id)`,
	`CREATE INDEX IF NOT EXISTS idx_forensic_events_run ON forensic_events(run_id, timestamp, event_id)`,
	`CREATE INDEX IF NOT EXISTS idx_forensic_events_dispatch ON forensic_events(dispatch_id, timestamp, event_id)`,
	`CREATE INDEX IF NOT EXISTS idx_forensic_events_type ON forensic_events(type, timestamp, event_id)`,
	`CREATE TABLE IF NOT EXISTS recovery_state (
		session_id TEXT PRIMARY KEY,
		state_json TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	...BACKGROUND_TASKS_SCHEMA_STATEMENTS,
]);
