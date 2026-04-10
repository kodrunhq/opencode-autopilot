/**
 * Code graph types for the TS/JS code graph MVP.
 *
 * Stores structural relationships (imports, exports, extends, implements, contains)
 * between source symbols with exact byte offsets for retrieval.
 */

/** Supported node types in the code graph. */
export type GraphNodeType = "file" | "function" | "class" | "interface" | "method";

/** Supported edge types in the code graph. */
export type GraphEdgeType = "imports" | "exports" | "extends" | "implements" | "contains";

/** A single node in the code graph. */
export interface GraphNode {
	/** Unique ID: `{filePath}:{lineStart}:{name}` */
	readonly id: string;
	readonly type: GraphNodeType;
	readonly name: string;
	readonly filePath: string;
	/** UTF-8 byte offset of the node's start in the file. */
	readonly byteStart: number;
	/** UTF-8 byte offset of the node's end in the file (exclusive). */
	readonly byteEnd: number;
	/** 1-based line number of the node's start. */
	readonly lineStart: number;
	/** 1-based line number of the node's end. */
	readonly lineEnd: number;
	/** Content hash for stale detection. */
	readonly hash: string;
}

/** A directed edge between two graph nodes. */
export interface GraphEdge {
	readonly from: string;
	readonly to: string;
	readonly type: GraphEdgeType;
}

/** Result of parsing a single file. */
export interface ParsedFile {
	readonly filePath: string;
	readonly nodes: readonly GraphNode[];
	readonly edges: readonly GraphEdge[];
}

/** Supported file extensions for the graph parser. */
export const GRAPH_SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

/** Check if a file path is supported by the graph parser. */
export function isGraphSupportedFile(filePath: string): boolean {
	const extIndex = filePath.lastIndexOf(".");
	if (extIndex < 0) {
		return false;
	}

	return GRAPH_SUPPORTED_EXTENSIONS.has(filePath.substring(extIndex));
}

/** Current parser version — bump when AST extraction logic changes. */
export const GRAPH_PARSER_VERSION = 1;

/** Current index schema version — bump when graph DDL changes. */
export const GRAPH_INDEX_SCHEMA_VERSION = 1;
