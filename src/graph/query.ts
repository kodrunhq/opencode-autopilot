import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { getFileIndexRecord } from "./repository";
import { GRAPH_INDEX_SCHEMA_VERSION, GRAPH_PARSER_VERSION } from "./types";

export interface SymbolHit {
	readonly name: string;
	readonly type: string;
	readonly filePath: string;
	readonly byteStart: number;
	readonly byteEnd: number;
	readonly lineStart: number;
	readonly lineEnd: number;
}

export interface FileEdge {
	readonly fromPath: string;
	readonly toPath: string;
	readonly edgeType: string;
}

export interface GraphQueryResult<T> {
	readonly data: T;
	readonly stale: boolean;
	readonly staleFiles: readonly string[];
	readonly fallbackHint: string | null;
}

function createContentHash(sourceText: string): string {
	return createHash("sha256").update(sourceText).digest("hex").slice(0, 16);
}

function freezeQueryResult<T>(data: T, staleFiles: readonly string[], fallbackHint: string | null) {
	const normalizedStaleFiles = Object.freeze([...staleFiles]);
	return Object.freeze({
		data,
		stale: normalizedStaleFiles.length > 0,
		staleFiles: normalizedStaleFiles,
		fallbackHint,
	});
}

/** Check if a specific file's index is stale. */
async function isFileStale(
	db: Database,
	projectId: string,
	relativePath: string,
	projectRoot: string,
): Promise<boolean> {
	const record = getFileIndexRecord(db, projectId, relativePath);
	if (!record) {
		return true;
	}

	if (record.parserVersion !== GRAPH_PARSER_VERSION) {
		return true;
	}

	if (record.indexSchemaVersion !== GRAPH_INDEX_SCHEMA_VERSION) {
		return true;
	}

	try {
		const absolutePath = join(projectRoot, relativePath);
		const statResult = await stat(absolutePath);
		if (statResult.mtimeMs !== record.mtimeMs) {
			return true;
		}

		const content = await readFile(absolutePath, "utf-8");
		return createContentHash(content) !== record.contentHash;
	} catch {
		return true;
	}
}

async function collectStaleFiles(
	db: Database,
	projectId: string,
	projectRoot: string,
	filePaths: readonly string[],
): Promise<readonly string[]> {
	const uniqueFilePaths = [...new Set(filePaths)];
	const staleFiles: string[] = [];

	for (const filePath of uniqueFilePaths) {
		if (await isFileStale(db, projectId, filePath, projectRoot)) {
			staleFiles.push(filePath);
		}
	}

	return Object.freeze(staleFiles);
}

/** Find all definitions matching a name. */
export async function findDefinitions(
	db: Database,
	projectId: string,
	projectRoot: string,
	name: string,
): Promise<GraphQueryResult<readonly SymbolHit[]>> {
	const rows = db
		.query(
			`SELECT name, type, file_path, byte_start, byte_end, line_start, line_end
			 FROM graph_nodes
			 WHERE project_id = ? AND name = ? AND type != 'file'
			 ORDER BY file_path, line_start`,
		)
		.all(projectId, name) as Array<{
		name: string;
		type: string;
		file_path: string;
		byte_start: number;
		byte_end: number;
		line_start: number;
		line_end: number;
	}>;

	const hits = Object.freeze(
		rows.map((row) =>
			Object.freeze({
				name: row.name,
				type: row.type,
				filePath: row.file_path,
				byteStart: row.byte_start,
				byteEnd: row.byte_end,
				lineStart: row.line_start,
				lineEnd: row.line_end,
			}),
		),
	);

	const staleFiles = await collectStaleFiles(
		db,
		projectId,
		projectRoot,
		rows.map((row) => row.file_path),
	);

	return freezeQueryResult(
		hits,
		staleFiles,
		staleFiles.length > 0
			? "Use oc_lsp_symbols or oc_lsp_goto_definition for authoritative results."
			: null,
	);
}

/** Find all imports for a file. */
export async function findImports(
	db: Database,
	projectId: string,
	projectRoot: string,
	filePath: string,
): Promise<GraphQueryResult<readonly FileEdge[]>> {
	const fileId = `${filePath}:1:${filePath}`;
	const rows = db
		.query(
			`SELECT source.file_path AS from_path, target.file_path AS to_path, e.type
			 FROM graph_edges e
			 INNER JOIN graph_nodes source ON source.id = e.from_id
			 INNER JOIN graph_nodes target ON target.id = e.to_id
			 WHERE e.project_id = ? AND e.from_id = ? AND e.type = 'imports'
			 ORDER BY target.file_path`,
		)
		.all(projectId, fileId) as Array<{
		from_path: string;
		to_path: string;
		type: string;
	}>;

	const edges = Object.freeze(
		rows.map((row) =>
			Object.freeze({
				fromPath: row.from_path,
				toPath: row.to_path,
				edgeType: row.type,
			}),
		),
	);
	const staleFiles = await collectStaleFiles(db, projectId, projectRoot, [filePath]);

	return freezeQueryResult(
		edges,
		staleFiles,
		staleFiles.length > 0 ? "Use grep or oc_lsp_find_references for import discovery." : null,
	);
}

/** Find all files that depend on (import from) a given file. */
export async function findDependents(
	db: Database,
	projectId: string,
	projectRoot: string,
	filePath: string,
): Promise<GraphQueryResult<readonly FileEdge[]>> {
	const fileId = `${filePath}:1:${filePath}`;
	const rows = db
		.query(
			`SELECT source.file_path AS from_path, target.file_path AS to_path, e.type
			 FROM graph_edges e
			 INNER JOIN graph_nodes source ON source.id = e.from_id
			 INNER JOIN graph_nodes target ON target.id = e.to_id
			 WHERE e.project_id = ? AND e.to_id = ? AND e.type = 'imports'
			 ORDER BY source.file_path`,
		)
		.all(projectId, fileId) as Array<{
		from_path: string;
		to_path: string;
		type: string;
	}>;

	const edges = Object.freeze(
		rows.map((row) =>
			Object.freeze({
				fromPath: row.from_path,
				toPath: row.to_path,
				edgeType: row.type,
			}),
		),
	);
	const staleFiles = await collectStaleFiles(db, projectId, projectRoot, [
		filePath,
		...rows.map((row) => row.from_path),
	]);

	return freezeQueryResult(
		edges,
		staleFiles,
		staleFiles.length > 0
			? "Use oc_lsp_find_references for authoritative dependency discovery."
			: null,
	);
}

/** Get a module outline (all symbols in a file). */
export async function getModuleOutline(
	db: Database,
	projectId: string,
	projectRoot: string,
	filePath: string,
): Promise<GraphQueryResult<readonly SymbolHit[]>> {
	const rows = db
		.query(
			`SELECT name, type, file_path, byte_start, byte_end, line_start, line_end
			 FROM graph_nodes
			 WHERE project_id = ? AND file_path = ? AND type != 'file'
			 ORDER BY line_start`,
		)
		.all(projectId, filePath) as Array<{
		name: string;
		type: string;
		file_path: string;
		byte_start: number;
		byte_end: number;
		line_start: number;
		line_end: number;
	}>;

	const hits = Object.freeze(
		rows.map((row) =>
			Object.freeze({
				name: row.name,
				type: row.type,
				filePath: row.file_path,
				byteStart: row.byte_start,
				byteEnd: row.byte_end,
				lineStart: row.line_start,
				lineEnd: row.line_end,
			}),
		),
	);
	const staleFiles = await collectStaleFiles(db, projectId, projectRoot, [filePath]);

	return freezeQueryResult(
		hits,
		staleFiles,
		staleFiles.length > 0 ? "Use oc_lsp_symbols for authoritative file outline." : null,
	);
}
