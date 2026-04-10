import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	getFileIndexRecord,
	getIndexedFiles,
	removeFileGraph,
	replaceFileGraph,
} from "../../src/graph/repository";
import { GRAPH_SCHEMA_STATEMENTS } from "../../src/graph/schema";
import type { GraphEdge, GraphNode } from "../../src/graph/types";

function setupDb(): Database {
	const db = new Database(":memory:");
	db.run("PRAGMA foreign_keys=ON");
	for (const statement of GRAPH_SCHEMA_STATEMENTS) {
		db.run(statement);
	}
	return db;
}

const TEST_NODES: readonly GraphNode[] = Object.freeze([
	Object.freeze({
		id: "src/hello.ts:1:src/hello.ts",
		type: "file",
		name: "src/hello.ts",
		filePath: "src/hello.ts",
		byteStart: 0,
		byteEnd: 50,
		lineStart: 1,
		lineEnd: 3,
		hash: "abc123",
	}),
	Object.freeze({
		id: "src/hello.ts:2:greeter",
		type: "function",
		name: "greeter",
		filePath: "src/hello.ts",
		byteStart: 10,
		byteEnd: 40,
		lineStart: 2,
		lineEnd: 2,
		hash: "def456",
	}),
]);

const TEST_EDGES: readonly GraphEdge[] = Object.freeze([
	Object.freeze({
		from: "src/hello.ts:1:src/hello.ts",
		to: "src/hello.ts:2:greeter",
		type: "contains",
	}),
]);

describe("graph repository", () => {
	let db: Database;

	beforeEach(() => {
		db = setupDb();
	});

	afterEach(() => {
		db.close();
	});

	test("replaceFileGraph inserts nodes and edges", () => {
		replaceFileGraph(db, "proj-1", "src/hello.ts", TEST_NODES, TEST_EDGES, {
			mtimeMs: 1000,
			contentHash: "abc",
			parserVersion: 1,
			indexSchemaVersion: 1,
		});

		const nodes = db.query("SELECT * FROM graph_nodes WHERE project_id = ?").all("proj-1");
		expect(nodes.length).toBe(2);

		const edges = db.query("SELECT * FROM graph_edges WHERE project_id = ?").all("proj-1");
		expect(edges.length).toBe(1);
	});

	test("replaceFileGraph replaces existing data", () => {
		replaceFileGraph(db, "proj-1", "src/hello.ts", TEST_NODES, TEST_EDGES, {
			mtimeMs: 1000,
			contentHash: "abc",
			parserVersion: 1,
			indexSchemaVersion: 1,
		});

		const newNodes: readonly GraphNode[] = Object.freeze([
			Object.freeze({
				id: "src/hello.ts:1:src/hello.ts",
				type: "file",
				name: "src/hello.ts",
				filePath: "src/hello.ts",
				byteStart: 0,
				byteEnd: 80,
				lineStart: 1,
				lineEnd: 5,
				hash: "xyz",
			}),
		]);

		replaceFileGraph(db, "proj-1", "src/hello.ts", newNodes, [], {
			mtimeMs: 2000,
			contentHash: "def",
			parserVersion: 1,
			indexSchemaVersion: 1,
		});

		const nodes = db
			.query("SELECT * FROM graph_nodes WHERE project_id = ? AND file_path = ?")
			.all("proj-1", "src/hello.ts");
		expect(nodes.length).toBe(1);
	});

	test("removeFileGraph deletes file data", () => {
		replaceFileGraph(db, "proj-1", "src/hello.ts", TEST_NODES, TEST_EDGES, {
			mtimeMs: 1000,
			contentHash: "abc",
			parserVersion: 1,
			indexSchemaVersion: 1,
		});

		removeFileGraph(db, "proj-1", "src/hello.ts");

		const nodes = db.query("SELECT * FROM graph_nodes WHERE project_id = ?").all("proj-1");
		expect(nodes.length).toBe(0);
		expect(getFileIndexRecord(db, "proj-1", "src/hello.ts")).toBeNull();
	});

	test("getFileIndexRecord returns metadata", () => {
		replaceFileGraph(db, "proj-1", "src/hello.ts", TEST_NODES, TEST_EDGES, {
			mtimeMs: 1000,
			contentHash: "abc",
			parserVersion: 1,
			indexSchemaVersion: 1,
		});

		const record = getFileIndexRecord(db, "proj-1", "src/hello.ts");
		expect(record).not.toBeNull();
		expect(record?.filePath).toBe("src/hello.ts");
		expect(record?.mtimeMs).toBe(1000);
		expect(record?.contentHash).toBe("abc");
	});

	test("getIndexedFiles lists all indexed files", () => {
		replaceFileGraph(
			db,
			"proj-1",
			"src/a.ts",
			[
				Object.freeze({
					id: "src/a.ts:1:src/a.ts",
					type: "file",
					name: "src/a.ts",
					filePath: "src/a.ts",
					byteStart: 0,
					byteEnd: 10,
					lineStart: 1,
					lineEnd: 1,
					hash: "a-node",
				}),
			],
			[],
			{ mtimeMs: 1000, contentHash: "a", parserVersion: 1, indexSchemaVersion: 1 },
		);
		replaceFileGraph(
			db,
			"proj-1",
			"src/b.ts",
			[
				Object.freeze({
					id: "src/b.ts:1:src/b.ts",
					type: "file",
					name: "src/b.ts",
					filePath: "src/b.ts",
					byteStart: 0,
					byteEnd: 10,
					lineStart: 1,
					lineEnd: 1,
					hash: "b-node",
				}),
			],
			[],
			{ mtimeMs: 2000, contentHash: "b", parserVersion: 1, indexSchemaVersion: 1 },
		);

		const files = getIndexedFiles(db, "proj-1");
		expect(files.length).toBe(2);
		expect(files.map((file) => file.filePath)).toEqual(["src/a.ts", "src/b.ts"]);
	});

	test("replaceFileGraph resolves implements edges by node name", () => {
		const interfaceNodes: readonly GraphNode[] = Object.freeze([
			Object.freeze({
				id: "src/types.ts:1:src/types.ts",
				type: "file",
				name: "src/types.ts",
				filePath: "src/types.ts",
				byteStart: 0,
				byteEnd: 30,
				lineStart: 1,
				lineEnd: 1,
				hash: "types-file",
			}),
			Object.freeze({
				id: "src/types.ts:1:Logger",
				type: "interface",
				name: "Logger",
				filePath: "src/types.ts",
				byteStart: 0,
				byteEnd: 20,
				lineStart: 1,
				lineEnd: 1,
				hash: "logger-iface",
			}),
		]);
		const classNodes: readonly GraphNode[] = Object.freeze([
			Object.freeze({
				id: "src/service.ts:1:src/service.ts",
				type: "file",
				name: "src/service.ts",
				filePath: "src/service.ts",
				byteStart: 0,
				byteEnd: 40,
				lineStart: 1,
				lineEnd: 1,
				hash: "service-file",
			}),
			Object.freeze({
				id: "src/service.ts:1:AppService",
				type: "class",
				name: "AppService",
				filePath: "src/service.ts",
				byteStart: 0,
				byteEnd: 25,
				lineStart: 1,
				lineEnd: 1,
				hash: "service-class",
			}),
		]);

		replaceFileGraph(db, "proj-1", "src/types.ts", interfaceNodes, [], {
			mtimeMs: 1000,
			contentHash: "types",
			parserVersion: 1,
			indexSchemaVersion: 1,
		});
		replaceFileGraph(
			db,
			"proj-1",
			"src/service.ts",
			classNodes,
			[
				Object.freeze({
					from: "src/service.ts:1:AppService",
					to: "Logger",
					type: "implements",
				}),
			],
			{
				mtimeMs: 2000,
				contentHash: "service",
				parserVersion: 1,
				indexSchemaVersion: 1,
			},
		);

		const edges = db
			.query("SELECT from_id, to_id, type FROM graph_edges WHERE project_id = ?")
			.all("proj-1") as Array<{ from_id: string; to_id: string; type: string }>;

		expect(edges).toEqual([
			{
				from_id: "src/service.ts:1:AppService",
				to_id: "src/types.ts:1:Logger",
				type: "implements",
			},
		]);
	});

	test("replaceFileGraph resolves heritage edges by node name", () => {
		const nodes: readonly GraphNode[] = Object.freeze([
			Object.freeze({
				id: "src/base.ts:1:src/base.ts",
				type: "file",
				name: "src/base.ts",
				filePath: "src/base.ts",
				byteStart: 0,
				byteEnd: 30,
				lineStart: 1,
				lineEnd: 1,
				hash: "base-file",
			}),
			Object.freeze({
				id: "src/base.ts:1:BaseService",
				type: "class",
				name: "BaseService",
				filePath: "src/base.ts",
				byteStart: 0,
				byteEnd: 20,
				lineStart: 1,
				lineEnd: 1,
				hash: "base-class",
			}),
		]);
		const derivedNodes: readonly GraphNode[] = Object.freeze([
			Object.freeze({
				id: "src/derived.ts:1:src/derived.ts",
				type: "file",
				name: "src/derived.ts",
				filePath: "src/derived.ts",
				byteStart: 0,
				byteEnd: 40,
				lineStart: 1,
				lineEnd: 1,
				hash: "derived-file",
			}),
			Object.freeze({
				id: "src/derived.ts:1:UserService",
				type: "class",
				name: "UserService",
				filePath: "src/derived.ts",
				byteStart: 0,
				byteEnd: 25,
				lineStart: 1,
				lineEnd: 1,
				hash: "derived-class",
			}),
		]);

		replaceFileGraph(db, "proj-1", "src/base.ts", nodes, [], {
			mtimeMs: 1000,
			contentHash: "base",
			parserVersion: 1,
			indexSchemaVersion: 1,
		});
		replaceFileGraph(
			db,
			"proj-1",
			"src/derived.ts",
			derivedNodes,
			[
				Object.freeze({
					from: "src/derived.ts:1:UserService",
					to: "BaseService",
					type: "extends",
				}),
			],
			{
				mtimeMs: 2000,
				contentHash: "derived",
				parserVersion: 1,
				indexSchemaVersion: 1,
			},
		);

		const edges = db
			.query("SELECT from_id, to_id, type FROM graph_edges WHERE project_id = ?")
			.all("proj-1") as Array<{ from_id: string; to_id: string; type: string }>;

		expect(edges).toEqual([
			{
				from_id: "src/derived.ts:1:UserService",
				to_id: "src/base.ts:1:BaseService",
				type: "extends",
			},
		]);
	});
});
