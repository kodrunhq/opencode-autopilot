export { indexFile, indexProject } from "./indexer";
export { buildUtf16ToUtf8OffsetMap, utf16ToUtf8ByteOffset } from "./offsets";
export { parseFile } from "./parser";
export type { FileEdge, GraphQueryResult, SymbolHit } from "./query";
export { findDefinitions, findDependents, findImports, getModuleOutline } from "./query";
export {
	clearProjectGraph,
	getFileIndexRecord,
	getIndexedFiles,
	removeFileGraph,
	replaceFileGraph,
} from "./repository";
export { GRAPH_SCHEMA_STATEMENTS } from "./schema";
export type { GraphEdge, GraphEdgeType, GraphNode, GraphNodeType, ParsedFile } from "./types";
export {
	GRAPH_INDEX_SCHEMA_VERSION,
	GRAPH_PARSER_VERSION,
	GRAPH_SUPPORTED_EXTENSIONS,
	isGraphSupportedFile,
} from "./types";
