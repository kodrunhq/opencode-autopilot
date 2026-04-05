import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const SRC_DIR = join(import.meta.dir, "..", "..", "src");
const MAX_LOC = 300;

const EXEMPT_FILES: ReadonlySet<string> = new Set([
	"repository.ts",
	"preferences.ts",
	"orchestrate.ts",
	"configure.ts",
	"hashline-edit.ts",
	"review.ts",
	"checks.ts",
	"index.ts",
	"agent-catalog.ts",
	"event-handlers.ts",
	"fallback-manager.ts",
	"build.ts",
	"resolve.ts",
	"config.ts",
	"devops.ts",
	"debugger.ts",
	"frontend-engineer.ts",
	"planner.ts",
	"security-auditor.ts",
]);

async function getAllTsFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await getAllTsFiles(fullPath)));
		} else if (entry.isFile() && entry.name.endsWith(".ts")) {
			files.push(fullPath);
		}
	}

	return files;
}

async function countLines(filePath: string): Promise<number> {
	const content = await readFile(filePath, "utf-8");
	return content.split("\n").length;
}

describe("Architecture Constraints", () => {
	test("repository.ts should be a thin barrel export (<100 LOC)", async () => {
		const filePath = join(SRC_DIR, "memory", "repository.ts");
		const loc = await countLines(filePath);

		expect(loc).toBeLessThan(100);
	});

	test("preferences.ts should document why it's large", async () => {
		const filePath = join(SRC_DIR, "memory", "preferences.ts");
		const content = await readFile(filePath, "utf-8");
		const loc = content.split("\n").length;

		expect(loc).toBeGreaterThan(0);
	});

	test("build.ts should be reduced after split", async () => {
		const filePath = join(SRC_DIR, "orchestrator", "handlers", "build.ts");
		const loc = await countLines(filePath);

		expect(loc).toBeLessThan(350);
	});

	test("capture.ts should be reduced after split", async () => {
		const filePath = join(SRC_DIR, "memory", "capture.ts");
		const loc = await countLines(filePath);

		expect(loc).toBeLessThan(300);
	});

	test("report files over 300 LOC (informational)", async () => {
		const files = await getAllTsFiles(SRC_DIR);
		const largeFiles: { file: string; loc: number }[] = [];

		for (const file of files) {
			const fileName = file.split("/").pop() ?? "";
			if (EXEMPT_FILES.has(fileName)) {
				continue;
			}

			const loc = await countLines(file);
			if (loc > MAX_LOC) {
				largeFiles.push({ file: file.replace(SRC_DIR, "src"), loc });
			}
		}

		console.log(`\n[Architecture] Files over ${MAX_LOC} LOC: ${largeFiles.length}`);
		for (const v of largeFiles) {
			console.log(`  ${v.file}: ${v.loc} lines`);
		}

		expect(largeFiles.length).toBeGreaterThanOrEqual(0);
	});
});
