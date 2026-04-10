import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	findDefinitions,
	findDependents,
	findImports,
	getModuleOutline,
} from "../../src/graph/query";
import { replaceFileGraph } from "../../src/graph/repository";
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

function createContentHash(sourceText: string): string {
	return createHash("sha256").update(sourceText).digest("hex").slice(0, 16);
}

async function writeIndexedGraphFile(
	db: Database,
	projectId: string,
	projectRoot: string,
	filePath: string,
	sourceText: string,
	nodes: readonly GraphNode[],
	edges: readonly GraphEdge[],
): Promise<void> {
	const absolutePath = join(projectRoot, filePath);
	await mkdir(join(projectRoot, filePath.split("/").slice(0, -1).join("/")), { recursive: true });
	await writeFile(absolutePath, sourceText);
	const statResult = await stat(absolutePath);

	replaceFileGraph(db, projectId, filePath, nodes, edges, {
		mtimeMs: statResult.mtimeMs,
		contentHash: createContentHash(sourceText),
		parserVersion: 1,
		indexSchemaVersion: 1,
	});
}

describe("graph query", () => {
	let db: Database;
	let tempDir: string;

	beforeEach(async () => {
		db = setupDb();
		tempDir = await mkdtemp(join(tmpdir(), `graph-query-test-${randomUUID()}-`));
	});

	afterEach(async () => {
		db.close();
		await rm(tempDir, { recursive: true, force: true });
	});

	test("findDefinitions returns matching symbols", async () => {
		await writeIndexedGraphFile(
			db,
			"proj-1",
			tempDir,
			"src/service.ts",
			"export class UserService {}\n",
			[
				Object.freeze({
					id: "src/service.ts:1:src/service.ts",
					type: "file",
					name: "src/service.ts",
					filePath: "src/service.ts",
					byteStart: 0,
					byteEnd: 29,
					lineStart: 1,
					lineEnd: 1,
					hash: "file-hash",
				}),
				Object.freeze({
					id: "src/service.ts:1:UserService",
					type: "class",
					name: "UserService",
					filePath: "src/service.ts",
					byteStart: 7,
					byteEnd: 28,
					lineStart: 1,
					lineEnd: 1,
					hash: "class-hash",
				}),
			],
			[],
		);

		const result = await findDefinitions(db, "proj-1", tempDir, "UserService");
		expect(result.data.length).toBe(1);
		expect(result.data[0]?.name).toBe("UserService");
		expect(result.data[0]?.type).toBe("class");
		expect(result.stale).toBe(false);
	});

	test("findImports returns import edges", async () => {
		await writeIndexedGraphFile(
			db,
			"proj-1",
			tempDir,
			"src/utils.ts",
			"export function helper(): void {}\n",
			[
				Object.freeze({
					id: "src/utils.ts:1:src/utils.ts",
					type: "file",
					name: "src/utils.ts",
					filePath: "src/utils.ts",
					byteStart: 0,
					byteEnd: 33,
					lineStart: 1,
					lineEnd: 1,
					hash: "utils-file-hash",
				}),
			],
			[],
		);

		await writeIndexedGraphFile(
			db,
			"proj-1",
			tempDir,
			"src/main.ts",
			"import { helper } from './utils';\nhelper();\n",
			[
				Object.freeze({
					id: "src/main.ts:1:src/main.ts",
					type: "file",
					name: "src/main.ts",
					filePath: "src/main.ts",
					byteStart: 0,
					byteEnd: 44,
					lineStart: 1,
					lineEnd: 2,
					hash: "main-file-hash",
				}),
			],
			[
				Object.freeze({
					from: "src/main.ts:1:src/main.ts",
					to: "src/utils.ts:1:src/utils.ts",
					type: "imports",
				}),
			],
		);

		const result = await findImports(db, "proj-1", tempDir, "src/main.ts");
		expect(result.data.length).toBe(1);
		expect(result.data[0]?.fromPath).toBe("src/main.ts");
		expect(result.data[0]?.toPath).toBe("src/utils.ts");
	});

	test("findDependents returns importing files", async () => {
		await writeIndexedGraphFile(
			db,
			"proj-1",
			tempDir,
			"src/utils.ts",
			"export function helper(): void {}\n",
			[
				Object.freeze({
					id: "src/utils.ts:1:src/utils.ts",
					type: "file",
					name: "src/utils.ts",
					filePath: "src/utils.ts",
					byteStart: 0,
					byteEnd: 33,
					lineStart: 1,
					lineEnd: 1,
					hash: "utils-file-hash",
				}),
			],
			[],
		);

		await writeIndexedGraphFile(
			db,
			"proj-1",
			tempDir,
			"src/main.ts",
			"import { helper } from './utils';\nhelper();\n",
			[
				Object.freeze({
					id: "src/main.ts:1:src/main.ts",
					type: "file",
					name: "src/main.ts",
					filePath: "src/main.ts",
					byteStart: 0,
					byteEnd: 44,
					lineStart: 1,
					lineEnd: 2,
					hash: "main-file-hash",
				}),
			],
			[
				Object.freeze({
					from: "src/main.ts:1:src/main.ts",
					to: "src/utils.ts:1:src/utils.ts",
					type: "imports",
				}),
			],
		);

		const result = await findDependents(db, "proj-1", tempDir, "src/utils.ts");
		expect(result.data.length).toBe(1);
		expect(result.data[0]?.fromPath).toBe("src/main.ts");
		expect(result.data[0]?.toPath).toBe("src/utils.ts");
	});

	test("getModuleOutline returns all symbols in a file", async () => {
		await writeIndexedGraphFile(
			db,
			"proj-1",
			tempDir,
			"src/mod.ts",
			"export function hello(): void {}\nexport interface World {}\n",
			[
				Object.freeze({
					id: "src/mod.ts:1:src/mod.ts",
					type: "file",
					name: "src/mod.ts",
					filePath: "src/mod.ts",
					byteStart: 0,
					byteEnd: 58,
					lineStart: 1,
					lineEnd: 2,
					hash: "mod-file-hash",
				}),
				Object.freeze({
					id: "src/mod.ts:1:hello",
					type: "function",
					name: "hello",
					filePath: "src/mod.ts",
					byteStart: 7,
					byteEnd: 32,
					lineStart: 1,
					lineEnd: 1,
					hash: "hello-hash",
				}),
				Object.freeze({
					id: "src/mod.ts:2:World",
					type: "interface",
					name: "World",
					filePath: "src/mod.ts",
					byteStart: 40,
					byteEnd: 58,
					lineStart: 2,
					lineEnd: 2,
					hash: "world-hash",
				}),
			],
			[],
		);

		const result = await getModuleOutline(db, "proj-1", tempDir, "src/mod.ts");
		expect(result.data.length).toBe(2);
		expect(result.data[0]?.name).toBe("hello");
		expect(result.data[1]?.name).toBe("World");
	});

	test("query result includes stale information", async () => {
		replaceFileGraph(
			db,
			"proj-1",
			"src/missing.ts",
			[
				Object.freeze({
					id: "src/missing.ts:1:src/missing.ts",
					type: "file",
					name: "src/missing.ts",
					filePath: "src/missing.ts",
					byteStart: 0,
					byteEnd: 50,
					lineStart: 1,
					lineEnd: 3,
					hash: "abc",
				}),
			],
			[],
			{ mtimeMs: 1000, contentHash: "abc", parserVersion: 1, indexSchemaVersion: 1 },
		);

		const result = await getModuleOutline(db, "proj-1", tempDir, "src/missing.ts");
		expect(result.stale).toBe(true);
		expect(result.fallbackHint).not.toBeNull();
	});

	test("findDefinitions returns empty for no matches", async () => {
		// Index a file first so the project is considered indexed.
		await writeIndexedGraphFile(
			db,
			"proj-1",
			tempDir,
			"src/existing.ts",
			"export class Existing {}\n",
			[
				Object.freeze({
					id: "src/existing.ts:1:src/existing.ts",
					type: "file",
					name: "src/existing.ts",
					filePath: "src/existing.ts",
					byteStart: 0,
					byteEnd: 26,
					lineStart: 1,
					lineEnd: 1,
					hash: "existing-file-hash",
				}),
				Object.freeze({
					id: "src/existing.ts:1:Existing",
					type: "class",
					name: "Existing",
					filePath: "src/existing.ts",
					byteStart: 7,
					byteEnd: 25,
					lineStart: 1,
					lineEnd: 1,
					hash: "existing-class-hash",
				}),
			],
			[],
		);

		const result = await findDefinitions(db, "proj-1", tempDir, "NonExistent");
		expect(result.data.length).toBe(0);
		expect(result.stale).toBe(false);
		expect(result.fallbackHint).toBeNull();
	});

	test("findDefinitions returns stale fallback for unindexed project", async () => {
		const result = await findDefinitions(db, "proj-unindexed", tempDir, "Anything");
		expect(result.data.length).toBe(0);
		expect(result.stale).toBe(true);
		expect(result.fallbackHint).not.toBeNull();
	});

	test("findImports returns stale fallback for unindexed project", async () => {
		const result = await findImports(db, "proj-unindexed", tempDir, "src/main.ts");
		expect(result.data.length).toBe(0);
		expect(result.stale).toBe(true);
		expect(result.fallbackHint).not.toBeNull();
	});

	test("findDependents returns stale fallback for unindexed project", async () => {
		const result = await findDependents(db, "proj-unindexed", tempDir, "src/utils.ts");
		expect(result.data.length).toBe(0);
		expect(result.stale).toBe(true);
		expect(result.fallbackHint).not.toBeNull();
	});

	test("getModuleOutline returns stale fallback for unindexed project", async () => {
		const result = await getModuleOutline(db, "proj-unindexed", tempDir, "src/mod.ts");
		expect(result.data.length).toBe(0);
		expect(result.stale).toBe(true);
		expect(result.fallbackHint).not.toBeNull();
	});
});
