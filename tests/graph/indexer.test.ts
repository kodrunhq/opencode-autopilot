import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { indexFile, indexProject } from "../../src/graph/indexer";
import { GRAPH_SCHEMA_STATEMENTS } from "../../src/graph/schema";

function setupDb(): Database {
	const db = new Database(":memory:");
	db.run("PRAGMA foreign_keys=ON");
	for (const statement of GRAPH_SCHEMA_STATEMENTS) {
		db.run(statement);
	}
	return db;
}

describe("graph indexer", () => {
	let db: Database;
	let tempDir: string;

	beforeEach(async () => {
		db = setupDb();
		tempDir = await mkdtemp(join(tmpdir(), `graph-indexer-test-${randomUUID()}-`));
	});

	afterEach(async () => {
		db.close();
		await rm(tempDir, { recursive: true, force: true });
	});

	test("indexes a TypeScript file", async () => {
		await writeFile(
			join(tempDir, "hello.ts"),
			`export function greet(name: string): string { return "Hello, " + name; }\n`,
		);

		const result = await indexFile(db, "proj-1", join(tempDir, "hello.ts"), "hello.ts");
		expect(result.indexed).toBe(true);
		expect(result.error).toBeUndefined();

		const nodes = db.query("SELECT * FROM graph_nodes WHERE project_id = ?").all("proj-1");
		expect(nodes.length).toBeGreaterThan(0);
	});

	test("skips unchanged files on reindex", async () => {
		await writeFile(join(tempDir, "hello.ts"), `export function greet(): void {}\n`);

		const firstResult = await indexFile(db, "proj-1", join(tempDir, "hello.ts"), "hello.ts");
		expect(firstResult.indexed).toBe(true);

		const secondResult = await indexFile(db, "proj-1", join(tempDir, "hello.ts"), "hello.ts");
		expect(secondResult.indexed).toBe(false);
	});

	test("skips unsupported files", async () => {
		await writeFile(join(tempDir, "style.css"), ".foo { color: red; }\n");

		const result = await indexFile(db, "proj-1", join(tempDir, "style.css"), "style.css");
		expect(result.indexed).toBe(false);
	});

	test("indexProject indexes multiple files", async () => {
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(join(tempDir, "src", "a.ts"), `export function a(): void {}\n`);
		await writeFile(join(tempDir, "src", "b.ts"), `export class B { method(): void {} }\n`);

		const result = await indexProject(db, "proj-1", tempDir, ["src/a.ts", "src/b.ts"]);
		expect(result.filesIndexed).toBe(2);
		expect(result.errors.length).toBe(0);
	});

	test("indexProject keeps previously indexed files during incremental reindex", async () => {
		await writeFile(join(tempDir, "a.ts"), `export function a(): void {}\n`);
		await writeFile(join(tempDir, "b.ts"), `export function b(): void {}\n`);

		await indexProject(db, "proj-1", tempDir, ["a.ts", "b.ts"]);

		const result = await indexProject(db, "proj-1", tempDir, ["a.ts"]);
		expect(result.filesRemoved).toBe(0);

		const indexedFiles = db
			.query("SELECT file_path FROM graph_files WHERE project_id = ? ORDER BY file_path")
			.all("proj-1") as Array<{ file_path: string }>;
		expect(indexedFiles.map((file) => file.file_path)).toEqual(["a.ts", "b.ts"]);
	});

	test("indexProject removes omitted files when cleanupMissing is enabled", async () => {
		await writeFile(join(tempDir, "a.ts"), `export function a(): void {}\n`);
		await writeFile(join(tempDir, "b.ts"), `export function b(): void {}\n`);

		await indexProject(db, "proj-1", tempDir, ["a.ts", "b.ts"]);

		const result = await indexProject(db, "proj-1", tempDir, ["a.ts"], {
			cleanupMissing: true,
		});
		expect(result.filesRemoved).toBe(1);
	});

	test("indexProject resolves relative imports to file nodes", async () => {
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(
			join(tempDir, "src", "main.ts"),
			`import { helper } from "./utils";\nexport function run(): void { helper(); }\n`,
		);
		await writeFile(join(tempDir, "src", "utils.ts"), `export function helper(): void {}\n`);

		const result = await indexProject(db, "proj-1", tempDir, ["src/main.ts", "src/utils.ts"]);
		expect(result.errors).toHaveLength(0);

		const imports = db
			.query(
				`SELECT e.from_id, e.to_id, target.file_path AS target_path
				 FROM graph_edges e
				 INNER JOIN graph_nodes target ON target.id = e.to_id
				 WHERE e.project_id = ? AND e.type = 'imports'`,
			)
			.all("proj-1") as Array<{ from_id: string; to_id: string; target_path: string }>;

		expect(imports).toHaveLength(1);
		expect(imports[0]?.from_id).toBe("src/main.ts:1:src/main.ts");
		expect(imports[0]?.to_id).toBe("src/utils.ts:1:src/utils.ts");
		expect(imports[0]?.target_path).toBe("src/utils.ts");
	});

	test("indexProject uses index files for module resolution", async () => {
		await mkdir(join(tempDir, "src", "lib"), { recursive: true });
		await writeFile(
			join(tempDir, "src", "main.ts"),
			`import { helper } from "./lib";\nexport function run(): void { helper(); }\n`,
		);
		await writeFile(join(tempDir, "src", "lib", "index.ts"), `export function helper(): void {}\n`);

		const result = await indexProject(db, "proj-1", tempDir, ["src/main.ts", "src/lib/index.ts"]);
		expect(result.errors).toHaveLength(0);

		const imports = db
			.query("SELECT to_id FROM graph_edges WHERE project_id = ? AND type = 'imports'")
			.all("proj-1") as Array<{ to_id: string }>;

		expect(imports).toHaveLength(1);
		expect(imports[0]?.to_id).toBe("src/lib/index.ts:1:src/lib/index.ts");
	});

	test("indexProject rebuilds module edges using all indexed files", async () => {
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(
			join(tempDir, "src", "main.ts"),
			`import { helper } from "./utils";\nexport function run(): void { helper(); }\n`,
		);
		await writeFile(join(tempDir, "src", "utils.ts"), `export function helper(): void {}\n`);

		await indexProject(db, "proj-1", tempDir, ["src/main.ts", "src/utils.ts"]);

		await writeFile(
			join(tempDir, "src", "main.ts"),
			`import { helper } from "./utils";\nexport function run(): void { helper(); helper(); }\n`,
		);

		const result = await indexProject(db, "proj-1", tempDir, ["src/main.ts"]);
		expect(result.errors).toHaveLength(0);

		const imports = db
			.query("SELECT from_id, to_id FROM graph_edges WHERE project_id = ? AND type = 'imports'")
			.all("proj-1") as Array<{ from_id: string; to_id: string }>;

		expect(imports).toHaveLength(1);
		expect(imports[0]).toEqual({
			from_id: "src/main.ts:1:src/main.ts",
			to_id: "src/utils.ts:1:src/utils.ts",
		});
	});

	test("indexProject only re-resolves edges for changed files", async () => {
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(
			join(tempDir, "src", "a.ts"),
			`import { b } from "./b";\nexport function a(): void { b(); }\n`,
		);
		await writeFile(
			join(tempDir, "src", "b.ts"),
			`import { c } from "./c";\nexport function b(): void { c(); }\n`,
		);
		await writeFile(join(tempDir, "src", "c.ts"), `export function c(): void {}\n`);

		await indexProject(db, "proj-1", tempDir, ["src/a.ts", "src/b.ts", "src/c.ts"]);

		const importsBefore = db
			.query("SELECT COUNT(*) as cnt FROM graph_edges WHERE project_id = ? AND type = 'imports'")
			.get("proj-1") as { cnt: number };
		expect(importsBefore.cnt).toBe(2);

		await writeFile(
			join(tempDir, "src", "a.ts"),
			`import { b } from "./b";\nexport function a(): void { b(); b(); }\n`,
		);

		const result = await indexProject(db, "proj-1", tempDir, ["src/a.ts", "src/b.ts", "src/c.ts"]);
		expect(result.filesIndexed).toBe(1);
		expect(result.filesSkipped).toBe(2);

		const importsAfter = db
			.query("SELECT COUNT(*) as cnt FROM graph_edges WHERE project_id = ? AND type = 'imports'")
			.get("proj-1") as { cnt: number };
		expect(importsAfter.cnt).toBe(2);

		const bEdges = db
			.query(
				"SELECT from_id, to_id FROM graph_edges WHERE project_id = ? AND from_id LIKE '%b.ts%' AND type = 'imports'",
			)
			.all("proj-1") as Array<{ from_id: string; to_id: string }>;
		expect(bEdges).toHaveLength(1);
		expect(bEdges[0]?.to_id).toBe("src/c.ts:1:src/c.ts");
	});

	test("indexProject preserves inbound import edges when target file changes", async () => {
		await mkdir(join(tempDir, "src"), { recursive: true });
		await writeFile(
			join(tempDir, "src", "main.ts"),
			`import { helper } from "./utils";\nexport function run(): void { helper(); }\n`,
		);
		await writeFile(join(tempDir, "src", "utils.ts"), `export function helper(): void {}\n`);

		await indexProject(db, "proj-1", tempDir, ["src/main.ts", "src/utils.ts"]);

		const importsBefore = db
			.query("SELECT from_id, to_id FROM graph_edges WHERE project_id = ? AND type = 'imports'")
			.all("proj-1") as Array<{ from_id: string; to_id: string }>;
		expect(importsBefore).toHaveLength(1);
		expect(importsBefore[0]?.from_id).toBe("src/main.ts:1:src/main.ts");
		expect(importsBefore[0]?.to_id).toBe("src/utils.ts:1:src/utils.ts");

		await writeFile(
			join(tempDir, "src", "utils.ts"),
			`export function helper(): void { console.log("hi"); }\n`,
		);

		const result = await indexProject(db, "proj-1", tempDir, ["src/main.ts", "src/utils.ts"]);
		expect(result.filesIndexed).toBe(1);
		expect(result.filesSkipped).toBe(1);

		const importsAfter = db
			.query("SELECT from_id, to_id FROM graph_edges WHERE project_id = ? AND type = 'imports'")
			.all("proj-1") as Array<{ from_id: string; to_id: string }>;
		expect(importsAfter).toHaveLength(1);
		expect(importsAfter[0]?.from_id).toBe("src/main.ts:1:src/main.ts");
		expect(importsAfter[0]?.to_id).toBe("src/utils.ts:1:src/utils.ts");
	});
});
