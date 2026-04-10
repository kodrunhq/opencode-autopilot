import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { parseFile } from "./parser";
import {
	clearProjectGraph,
	getFileIndexRecord,
	getIndexedFiles,
	removeFileGraph,
	replaceFileGraph,
} from "./repository";
import {
	GRAPH_INDEX_SCHEMA_VERSION,
	GRAPH_PARSER_VERSION,
	GRAPH_SUPPORTED_EXTENSIONS,
	isGraphSupportedFile,
} from "./types";

export interface IndexResult {
	readonly filesIndexed: number;
	readonly filesRemoved: number;
	readonly filesSkipped: number;
	readonly errors: readonly { readonly filePath: string; readonly error: string }[];
}

interface FileMetadata {
	readonly mtimeMs: number;
	readonly contentHash: string;
}

interface ParsedProjectFile extends FileMetadata {
	readonly filePath: string;
	readonly sourceText: string;
}

interface ReindexRecord {
	readonly mtimeMs: number;
	readonly contentHash: string;
	readonly parserVersion: number;
	readonly indexSchemaVersion: number;
}

function createContentHash(sourceText: string): string {
	return createHash("sha256").update(sourceText).digest("hex").slice(0, 16);
}

/** Check if a file needs reindexing. */
function needsReindex(
	record: ReindexRecord | null,
	currentMtimeMs: number,
	contentHash: string,
): boolean {
	if (!record) {
		return true;
	}

	if (record.parserVersion !== GRAPH_PARSER_VERSION) {
		return true;
	}

	if (record.indexSchemaVersion !== GRAPH_INDEX_SCHEMA_VERSION) {
		return true;
	}

	if (record.mtimeMs !== currentMtimeMs) {
		return true;
	}

	return record.contentHash !== contentHash;
}

async function readIndexedFile(
	absoluteFilePath: string,
	relativeFilePath: string,
): Promise<ParsedProjectFile> {
	const [sourceText, statResult] = await Promise.all([
		readFile(absoluteFilePath, "utf-8"),
		stat(absoluteFilePath),
	]);

	return Object.freeze({
		filePath: relativeFilePath,
		sourceText,
		mtimeMs: statResult.mtimeMs,
		contentHash: createContentHash(sourceText),
	});
}

function resolveModulePath(
	fromFilePath: string,
	moduleSpecifier: string,
	projectFiles: ReadonlySet<string>,
): string | null {
	if (!moduleSpecifier.startsWith(".")) {
		return null;
	}

	const normalizedBase = posix.normalize(posix.join(dirname(fromFilePath), moduleSpecifier));
	const exactMatch = normalizedBase.startsWith("./") ? normalizedBase.slice(2) : normalizedBase;

	if (projectFiles.has(exactMatch)) {
		return exactMatch;
	}

	const extensionIndex = exactMatch.lastIndexOf(".");
	const hasKnownExtension =
		extensionIndex >= 0 && GRAPH_SUPPORTED_EXTENSIONS.has(exactMatch.slice(extensionIndex));

	if (!hasKnownExtension) {
		for (const extension of GRAPH_SUPPORTED_EXTENSIONS) {
			const withExtension = `${exactMatch}${extension}`;
			if (projectFiles.has(withExtension)) {
				return withExtension;
			}

			const withIndex = posix.join(exactMatch, `index${extension}`);
			if (projectFiles.has(withIndex)) {
				return withIndex;
			}
		}
	}

	return null;
}

function rebuildResolvedModuleEdges(
	db: Database,
	projectId: string,
	changedFiles: readonly ParsedProjectFile[],
	allIndexedPaths: ReadonlySet<string>,
): void {
	if (changedFiles.length === 0) {
		return;
	}

	db.run("BEGIN");

	try {
		const deleteEdgesForFile = db.prepare(
			"DELETE FROM graph_edges WHERE project_id = ? AND from_id = ? AND type IN ('imports', 'exports')",
		);

		for (const changedFile of changedFiles) {
			const sourceFileId = `${changedFile.filePath}:1:${changedFile.filePath}`;
			deleteEdgesForFile.run(projectId, sourceFileId);
		}

		const insertEdge = db.prepare(
			"INSERT OR IGNORE INTO graph_edges (from_id, to_id, type, project_id) VALUES (?, ?, ?, ?)",
		);

		for (const changedFile of changedFiles) {
			const parsed = parseFile(changedFile.sourceText, changedFile.filePath);
			const sourceFileId = `${changedFile.filePath}:1:${changedFile.filePath}`;

			for (const edge of parsed.edges) {
				if (edge.type !== "imports" && edge.type !== "exports") {
					continue;
				}

				const resolvedPath = resolveModulePath(changedFile.filePath, edge.to, allIndexedPaths);
				if (!resolvedPath) {
					continue;
				}

				insertEdge.run(sourceFileId, `${resolvedPath}:1:${resolvedPath}`, edge.type, projectId);
			}
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

/** Index a single file. */
export async function indexFile(
	db: Database,
	projectId: string,
	absoluteFilePath: string,
	relativeFilePath: string,
): Promise<{ indexed: boolean; error?: string }> {
	if (!isGraphSupportedFile(relativeFilePath)) {
		return { indexed: false };
	}

	try {
		const file = await readIndexedFile(absoluteFilePath, relativeFilePath);
		const record = getFileIndexRecord(db, projectId, relativeFilePath);
		if (!needsReindex(record, file.mtimeMs, file.contentHash)) {
			return { indexed: false };
		}

		const parsed = parseFile(file.sourceText, relativeFilePath);
		replaceFileGraph(db, projectId, relativeFilePath, parsed.nodes, parsed.edges, {
			mtimeMs: file.mtimeMs,
			contentHash: file.contentHash,
			parserVersion: GRAPH_PARSER_VERSION,
			indexSchemaVersion: GRAPH_INDEX_SCHEMA_VERSION,
		});

		return { indexed: true };
	} catch (error) {
		return {
			indexed: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/** Index all supported files in a project directory. */
export async function indexProject(
	db: Database,
	projectId: string,
	projectRoot: string,
	filePaths: readonly string[],
	options?: { readonly force?: boolean; readonly cleanupMissing?: boolean },
): Promise<IndexResult> {
	if (options?.force) {
		clearProjectGraph(db, projectId);
	}

	const supportedFilePaths = filePaths.filter((filePath) => isGraphSupportedFile(filePath));
	const indexedProjectFiles = new Map<string, ParsedProjectFile>();
	const errors: Array<{ filePath: string; error: string }> = [];
	let filesIndexed = 0;
	let filesSkipped = 0;
	const shouldCleanupMissing = options?.force || options?.cleanupMissing === true;

	for (const relativePath of supportedFilePaths) {
		const absolutePath = join(projectRoot, relativePath);

		try {
			const file = await readIndexedFile(absolutePath, relativePath);
			indexedProjectFiles.set(relativePath, file);

			const record = getFileIndexRecord(db, projectId, relativePath);
			if (!needsReindex(record, file.mtimeMs, file.contentHash)) {
				filesSkipped += 1;
				continue;
			}

			const parsed = parseFile(file.sourceText, relativePath);
			replaceFileGraph(db, projectId, relativePath, parsed.nodes, parsed.edges, {
				mtimeMs: file.mtimeMs,
				contentHash: file.contentHash,
				parserVersion: GRAPH_PARSER_VERSION,
				indexSchemaVersion: GRAPH_INDEX_SCHEMA_VERSION,
			});
			filesIndexed += 1;
		} catch (error) {
			errors.push({
				filePath: relativePath,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	let filesRemoved = 0;

	if (shouldCleanupMissing) {
		const indexedFiles = getIndexedFiles(db, projectId);
		const filePathSet = new Set(filePaths);

		for (const record of indexedFiles) {
			if (filePathSet.has(record.filePath)) {
				continue;
			}

			removeFileGraph(db, projectId, record.filePath);
			indexedProjectFiles.delete(record.filePath);
			filesRemoved += 1;
		}
	}

	if (errors.length === 0 && indexedProjectFiles.size > 0) {
		const allIndexedPaths = new Set(
			getIndexedFiles(db, projectId).map((record) => record.filePath),
		);
		rebuildResolvedModuleEdges(db, projectId, [...indexedProjectFiles.values()], allIndexedPaths);
	}

	return Object.freeze({
		filesIndexed,
		filesRemoved,
		filesSkipped,
		errors: Object.freeze(errors),
	});
}
