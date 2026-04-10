import type { Database } from "bun:sqlite";
import type { GraphEdge, GraphNode } from "./types";

export interface FileIndexRecord {
	readonly filePath: string;
	readonly mtimeMs: number;
	readonly contentHash: string;
	readonly parserVersion: number;
	readonly indexSchemaVersion: number;
	readonly indexedAt: string;
}

interface FileMeta {
	readonly mtimeMs: number;
	readonly contentHash: string;
	readonly parserVersion: number;
	readonly indexSchemaVersion: number;
}

function mapFileIndexRecord(row: Record<string, unknown>): FileIndexRecord {
	return Object.freeze({
		filePath: row.file_path as string,
		mtimeMs: row.mtime_ms as number,
		contentHash: row.content_hash as string,
		parserVersion: row.parser_version as number,
		indexSchemaVersion: row.index_schema_version as number,
		indexedAt: row.indexed_at as string,
	});
}

/** Insert or replace all graph data for a single file within a transaction. */
export function replaceFileGraph(
	db: Database,
	projectId: string,
	filePath: string,
	nodes: readonly GraphNode[],
	edges: readonly GraphEdge[],
	fileMeta: FileMeta,
): void {
	const indexedAt = new Date().toISOString();
	db.run("BEGIN");

	try {
		db.run(
			`INSERT INTO graph_files (
				project_id,
				file_path,
				mtime_ms,
				content_hash,
				parser_version,
				index_schema_version,
				indexed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(project_id, file_path) DO UPDATE SET
			 	mtime_ms = excluded.mtime_ms,
			 	content_hash = excluded.content_hash,
			 	parser_version = excluded.parser_version,
			 	index_schema_version = excluded.index_schema_version,
			 	indexed_at = excluded.indexed_at`,
			[
				projectId,
				filePath,
				fileMeta.mtimeMs,
				fileMeta.contentHash,
				fileMeta.parserVersion,
				fileMeta.indexSchemaVersion,
				indexedAt,
			],
		);

		db.run(
			"DELETE FROM graph_edges WHERE from_id IN (SELECT id FROM graph_nodes WHERE project_id = ? AND file_path = ?)",
			[projectId, filePath],
		);
		db.run(
			"DELETE FROM graph_edges WHERE to_id IN (SELECT id FROM graph_nodes WHERE project_id = ? AND file_path = ?)",
			[projectId, filePath],
		);
		db.run("DELETE FROM graph_nodes WHERE project_id = ? AND file_path = ?", [projectId, filePath]);

		const insertNode = db.prepare(
			`INSERT INTO graph_nodes (
				id,
				project_id,
				type,
				name,
				file_path,
				byte_start,
				byte_end,
				line_start,
				line_end,
				hash
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		);

		for (const node of nodes) {
			insertNode.run(
				node.id,
				projectId,
				node.type,
				node.name,
				node.filePath,
				node.byteStart,
				node.byteEnd,
				node.lineStart,
				node.lineEnd,
				node.hash,
			);
		}

		const hasNode = db.prepare("SELECT 1 FROM graph_nodes WHERE id = ? LIMIT 1");
		const insertEdge = db.prepare(
			"INSERT OR IGNORE INTO graph_edges (from_id, to_id, type, project_id) VALUES (?, ?, ?, ?)",
		);

		for (const edge of edges) {
			const fromNode = hasNode.get(edge.from) as Record<string, unknown> | null;
			const toNode = hasNode.get(edge.to) as Record<string, unknown> | null;
			if (!fromNode || !toNode) {
				continue;
			}

			insertEdge.run(edge.from, edge.to, edge.type, projectId);
		}

		db.run("COMMIT");
	} catch (error) {
		try {
			db.run("ROLLBACK");
		} catch {
			// Ignore rollback failures.
		}
		throw error;
	}
}

/** Remove all graph data for a file. */
export function removeFileGraph(db: Database, projectId: string, filePath: string): void {
	db.run("BEGIN");
	try {
		db.run(
			"DELETE FROM graph_edges WHERE from_id IN (SELECT id FROM graph_nodes WHERE project_id = ? AND file_path = ?)",
			[projectId, filePath],
		);
		db.run(
			"DELETE FROM graph_edges WHERE to_id IN (SELECT id FROM graph_nodes WHERE project_id = ? AND file_path = ?)",
			[projectId, filePath],
		);
		db.run("DELETE FROM graph_nodes WHERE project_id = ? AND file_path = ?", [projectId, filePath]);
		db.run("DELETE FROM graph_files WHERE project_id = ? AND file_path = ?", [projectId, filePath]);
		db.run("COMMIT");
	} catch (error) {
		try {
			db.run("ROLLBACK");
		} catch {
			// Ignore rollback failures.
		}
		throw error;
	}
}

/** Get file index record. */
export function getFileIndexRecord(
	db: Database,
	projectId: string,
	filePath: string,
): FileIndexRecord | null {
	const row = db
		.query("SELECT * FROM graph_files WHERE project_id = ? AND file_path = ?")
		.get(projectId, filePath) as Record<string, unknown> | null;

	if (!row) {
		return null;
	}

	return mapFileIndexRecord(row);
}

/** Get all indexed files for a project. */
export function getIndexedFiles(db: Database, projectId: string): readonly FileIndexRecord[] {
	const rows = db
		.query("SELECT * FROM graph_files WHERE project_id = ? ORDER BY file_path")
		.all(projectId) as Array<Record<string, unknown>>;

	return Object.freeze(rows.map((row) => mapFileIndexRecord(row)));
}

/** Remove all graph data for a project. */
export function clearProjectGraph(db: Database, projectId: string): void {
	db.run("BEGIN");
	try {
		db.run("DELETE FROM graph_edges WHERE project_id = ?", [projectId]);
		db.run("DELETE FROM graph_nodes WHERE project_id = ?", [projectId]);
		db.run("DELETE FROM graph_files WHERE project_id = ?", [projectId]);
		db.run("COMMIT");
	} catch (error) {
		try {
			db.run("ROLLBACK");
		} catch {
			// Ignore rollback failures.
		}
		throw error;
	}
}
