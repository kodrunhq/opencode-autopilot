/**
 * SQLite DDL for the code graph.
 *
 * Tables are added to kernel.db with a `graph_` prefix.
 * Uses IF NOT EXISTS for idempotent creation.
 */

export const GRAPH_SCHEMA_STATEMENTS: readonly string[] = Object.freeze([
	`CREATE TABLE IF NOT EXISTS graph_files (
		project_id TEXT NOT NULL,
		file_path TEXT NOT NULL,
		mtime_ms INTEGER NOT NULL,
		content_hash TEXT NOT NULL,
		parser_version INTEGER NOT NULL,
		index_schema_version INTEGER NOT NULL,
		indexed_at TEXT NOT NULL,
		PRIMARY KEY (project_id, file_path)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_graph_files_hash ON graph_files(content_hash)`,
	`CREATE TABLE IF NOT EXISTS graph_nodes (
		id TEXT PRIMARY KEY,
		project_id TEXT NOT NULL,
		type TEXT NOT NULL CHECK(type IN ('file','function','class','interface','method')),
		name TEXT NOT NULL,
		file_path TEXT NOT NULL,
		byte_start INTEGER NOT NULL,
		byte_end INTEGER NOT NULL,
		line_start INTEGER NOT NULL,
		line_end INTEGER NOT NULL,
		hash TEXT NOT NULL,
		FOREIGN KEY (project_id, file_path) REFERENCES graph_files(project_id, file_path) ON DELETE CASCADE
	)`,
	`CREATE INDEX IF NOT EXISTS idx_graph_nodes_project_type ON graph_nodes(project_id, type, name)`,
	`CREATE INDEX IF NOT EXISTS idx_graph_nodes_project_file ON graph_nodes(project_id, file_path)`,
	`CREATE INDEX IF NOT EXISTS idx_graph_nodes_name ON graph_nodes(project_id, name)`,
	`CREATE TABLE IF NOT EXISTS graph_edges (
		from_id TEXT NOT NULL,
		to_id TEXT NOT NULL,
		type TEXT NOT NULL CHECK(type IN ('imports','exports','extends','implements','contains')),
		project_id TEXT NOT NULL,
		PRIMARY KEY (from_id, to_id, type),
		FOREIGN KEY (from_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
		FOREIGN KEY (to_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
	)`,
	`CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges(from_id, type)`,
	`CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON graph_edges(to_id, type)`,
	`CREATE INDEX IF NOT EXISTS idx_graph_edges_project ON graph_edges(project_id, type)`,
]);
