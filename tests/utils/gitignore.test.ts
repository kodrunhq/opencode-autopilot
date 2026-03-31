import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureGitignore } from "../../src/utils/gitignore";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "gitignore-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("ensureGitignore", () => {
	test("creates .gitignore with .opencode-assets/ if it does not exist", async () => {
		await ensureGitignore(tempDir);
		const content = await readFile(join(tempDir, ".gitignore"), "utf-8");
		expect(content).toContain(".opencode-assets/");
	});

	test("appends .opencode-assets/ to existing .gitignore without it", async () => {
		await writeFile(join(tempDir, ".gitignore"), "node_modules/\n", "utf-8");
		await ensureGitignore(tempDir);
		const content = await readFile(join(tempDir, ".gitignore"), "utf-8");
		expect(content).toContain("node_modules/");
		expect(content).toContain(".opencode-assets/");
	});

	test("does nothing if .opencode-assets/ already in .gitignore", async () => {
		const original = "node_modules/\n.opencode-assets/\n";
		await writeFile(join(tempDir, ".gitignore"), original, "utf-8");
		await ensureGitignore(tempDir);
		const content = await readFile(join(tempDir, ".gitignore"), "utf-8");
		expect(content).toBe(original);
	});
});
