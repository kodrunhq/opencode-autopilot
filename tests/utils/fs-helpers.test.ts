import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	copyIfMissing,
	ensureDir,
	fileExists,
	isEnoentError,
} from "../../src/utils/fs-helpers";

describe("isEnoentError", () => {
	test("returns true for ENOENT error", () => {
		const err = Object.assign(new Error("not found"), { code: "ENOENT" });
		expect(isEnoentError(err)).toBe(true);
	});

	test("returns false for other error codes", () => {
		const err = Object.assign(new Error("permission denied"), {
			code: "EACCES",
		});
		expect(isEnoentError(err)).toBe(false);
	});

	test("returns false for non-Error values", () => {
		expect(isEnoentError("ENOENT")).toBe(false);
		expect(isEnoentError(null)).toBe(false);
		expect(isEnoentError(undefined)).toBe(false);
	});
});

describe("fileExists", () => {
	test("returns true for an existing file", async () => {
		const result = await fileExists(import.meta.path);
		expect(result).toBe(true);
	});

	test("returns false for a non-existent file", async () => {
		const result = await fileExists("/tmp/non-existent-file-abc123xyz");
		expect(result).toBe(false);
	});
});

describe("ensureDir", () => {
	let tempDir: string;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("creates nested directories without error", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "oca-test-"));
		const nested = join(tempDir, "a", "b", "c");
		await ensureDir(nested);
		const exists = await fileExists(nested);
		expect(exists).toBe(true);
	});

	test("does not throw if directory already exists", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "oca-test-"));
		await ensureDir(tempDir);
		const exists = await fileExists(tempDir);
		expect(exists).toBe(true);
	});
});

describe("copyIfMissing", () => {
	let tempDir: string;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("copies file when target does not exist", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "oca-test-"));
		const source = import.meta.path;
		const target = join(tempDir, "copied-file.ts");

		const result = await copyIfMissing(source, target);
		expect(result.copied).toBe(true);

		const exists = await fileExists(target);
		expect(exists).toBe(true);
	});

	test("skips copy when target already exists", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "oca-test-"));
		const source = import.meta.path;
		const target = join(tempDir, "existing-file.ts");

		await writeFile(target, "existing content");

		const result = await copyIfMissing(source, target);
		expect(result.copied).toBe(false);
	});

	test("creates parent directories for target", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "oca-test-"));
		const source = import.meta.path;
		const target = join(tempDir, "sub", "dir", "file.ts");

		const result = await copyIfMissing(source, target);
		expect(result.copied).toBe(true);

		const exists = await fileExists(target);
		expect(exists).toBe(true);
	});
});
