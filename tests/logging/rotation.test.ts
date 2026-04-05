import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createGunzip } from "node:zlib";
import { exceedsMaxSize, rotateFile, rotateLogs } from "../../src/logging/rotation";

const TMP_BASE = join(import.meta.dir, "__rotation_tmp__");

async function makeDir(name: string): Promise<string> {
	const dir = join(TMP_BASE, name);
	await mkdir(dir, { recursive: true });
	return dir;
}

async function writeLog(dir: string, name: string, content: string): Promise<string> {
	const filePath = join(dir, name);
	await writeFile(filePath, content);
	return filePath;
}

async function setMtime(filePath: string, msAgo: number): Promise<void> {
	const { utimes } = await import("node:fs/promises");
	const t = new Date(Date.now() - msAgo);
	await utimes(filePath, t, t);
}

async function readGzip(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		const stream = createReadStream(filePath).pipe(createGunzip());
		stream.on("data", (chunk: Buffer) => chunks.push(chunk));
		stream.on("end", () => resolve(Buffer.concat(chunks).toString()));
		stream.on("error", reject);
	});
}

beforeEach(async () => {
	await mkdir(TMP_BASE, { recursive: true });
});

afterEach(async () => {
	await rm(TMP_BASE, { recursive: true, force: true });
});

describe("exceedsMaxSize", () => {
	it("returns false for a file smaller than the limit", async () => {
		const dir = await makeDir("small");
		const filePath = await writeLog(dir, "app.log", "hello");
		expect(await exceedsMaxSize(filePath, 100)).toBe(false);
	});

	it("returns true for a file larger than the limit", async () => {
		const dir = await makeDir("large");
		const content = "x".repeat(1024);
		const filePath = await writeLog(dir, "app.log", content);
		expect(await exceedsMaxSize(filePath, 512)).toBe(true);
	});

	it("returns false for a non-existent file", async () => {
		expect(await exceedsMaxSize(join(TMP_BASE, "ghost.log"), 1)).toBe(false);
	});

	it("returns false when file size equals limit exactly", async () => {
		const dir = await makeDir("exact");
		const filePath = await writeLog(dir, "app.log", "abc");
		expect(await exceedsMaxSize(filePath, 3)).toBe(false);
	});
});

describe("rotateFile", () => {
	it("compresses a .log file to .log.gz and removes the original", async () => {
		const dir = await makeDir("rotate-log");
		const filePath = await writeLog(dir, "app.log", "log content");

		const result = await rotateFile(filePath);

		expect(result).toBe(true);
		const files = await readdir(dir);
		expect(files).not.toContain("app.log");
		expect(files).toContain("app.log.gz");

		const decompressed = await readGzip(join(dir, "app.log.gz"));
		expect(decompressed).toBe("log content");
	});

	it("compresses a .jsonl file to .jsonl.gz", async () => {
		const dir = await makeDir("rotate-jsonl");
		const filePath = await writeLog(dir, "events.jsonl", '{"x":1}');

		await rotateFile(filePath);

		const files = await readdir(dir);
		expect(files).toContain("events.jsonl.gz");
		expect(files).not.toContain("events.jsonl");
	});

	it("renames a non-compressible file with a .bak suffix", async () => {
		const dir = await makeDir("rotate-bak");
		const filePath = await writeLog(dir, "notes.txt", "notes");

		const result = await rotateFile(filePath);

		expect(result).toBe(true);
		const files = await readdir(dir);
		expect(files).not.toContain("notes.txt");
		const bakFile = files.find((f) => f.startsWith("notes.txt.") && f.endsWith(".bak"));
		expect(bakFile).toBeDefined();
	});

	it("returns false for a non-existent file", async () => {
		const result = await rotateFile(join(TMP_BASE, "ghost.log"));
		expect(result).toBe(false);
	});
});

describe("rotateLogs size-based compression", () => {
	it("compresses files exceeding maxSize", async () => {
		const dir = await makeDir("size-compress");
		await writeLog(dir, "big.log", "x".repeat(200));
		await writeLog(dir, "small.log", "hi");

		const result = await rotateLogs(dir, { maxSize: 100, maxFiles: 99, maxAgeDays: 365 });

		expect(result.compressed).toBe(1);
		const files = await readdir(dir);
		expect(files).toContain("big.log.gz");
		expect(files).not.toContain("big.log");
		expect(files).toContain("small.log");
	});

	it("does not compress files at or below maxSize", async () => {
		const dir = await makeDir("size-skip");
		await writeLog(dir, "app.log", "small");

		const result = await rotateLogs(dir, { maxSize: 10_000, maxFiles: 99, maxAgeDays: 365 });

		expect(result.compressed).toBe(0);
		const files = await readdir(dir);
		expect(files).toContain("app.log");
	});

	it("does not attempt to re-compress existing .gz archives", async () => {
		const dir = await makeDir("no-recompress");
		await writeLog(dir, "archive.log.gz", "already compressed data");

		const result = await rotateLogs(dir, { maxSize: 1, maxFiles: 99, maxAgeDays: 365 });

		expect(result.compressed).toBe(0);
		const files = await readdir(dir);
		expect(files).toContain("archive.log.gz");
	});
});

describe("rotateLogs age-based deletion", () => {
	it("deletes files older than maxAgeDays", async () => {
		const dir = await makeDir("age-delete");
		const oldPath = await writeLog(dir, "old.log", "old");
		await setMtime(oldPath, 40 * 24 * 60 * 60 * 1000);
		await writeLog(dir, "new.log", "new");

		const result = await rotateLogs(dir, { maxSize: 999_999, maxFiles: 99, maxAgeDays: 30 });

		expect(result.deleted).toBeGreaterThanOrEqual(1);
		const files = await readdir(dir);
		expect(files).not.toContain("old.log");
		expect(files).toContain("new.log");
	});

	it("also deletes old .gz archives", async () => {
		const dir = await makeDir("age-delete-gz");
		const archivePath = await writeLog(dir, "old.log.gz", "compressed");
		await setMtime(archivePath, 40 * 24 * 60 * 60 * 1000);

		const result = await rotateLogs(dir, { maxSize: 999_999, maxFiles: 99, maxAgeDays: 30 });

		expect(result.deleted).toBeGreaterThanOrEqual(1);
		const files = await readdir(dir);
		expect(files).not.toContain("old.log.gz");
	});

	it("keeps files younger than maxAgeDays", async () => {
		const dir = await makeDir("age-keep");
		await writeLog(dir, "recent.log", "data");

		const result = await rotateLogs(dir, { maxSize: 999_999, maxFiles: 99, maxAgeDays: 30 });

		expect(result.deleted).toBe(0);
		const files = await readdir(dir);
		expect(files).toContain("recent.log");
	});
});

describe("rotateLogs count-based pruning", () => {
	it("prunes oldest log files when count exceeds maxFiles", async () => {
		const dir = await makeDir("count-prune");

		for (let i = 0; i < 5; i++) {
			const filePath = await writeLog(dir, `session-${i}.log`, `content ${i}`);
			await setMtime(filePath, (5 - i) * 60 * 1000);
		}

		const result = await rotateLogs(dir, { maxSize: 999_999, maxFiles: 3, maxAgeDays: 365 });

		expect(result.deleted).toBe(2);
		const files = await readdir(dir);
		expect(files).toHaveLength(3);
		expect(files).toContain("session-4.log");
		expect(files).toContain("session-3.log");
		expect(files).toContain("session-2.log");
		expect(files).not.toContain("session-0.log");
		expect(files).not.toContain("session-1.log");
	});

	it("does not count .gz archives against maxFiles", async () => {
		const dir = await makeDir("count-gz-exempt");

		for (let i = 0; i < 3; i++) {
			await writeLog(dir, `session-${i}.log`, `content ${i}`);
		}
		await writeLog(dir, "archive.log.gz", "gz");

		const result = await rotateLogs(dir, { maxSize: 999_999, maxFiles: 3, maxAgeDays: 365 });

		expect(result.deleted).toBe(0);
		const files = await readdir(dir);
		expect(files).toContain("archive.log.gz");
	});

	it("does nothing when file count is below maxFiles", async () => {
		const dir = await makeDir("count-ok");
		await writeLog(dir, "a.log", "a");
		await writeLog(dir, "b.log", "b");

		const result = await rotateLogs(dir, { maxSize: 999_999, maxFiles: 10, maxAgeDays: 365 });

		expect(result.deleted).toBe(0);
	});
});

describe("rotateLogs edge cases", () => {
	it("returns zero counts for a missing directory", async () => {
		const result = await rotateLogs(join(TMP_BASE, "nonexistent"));
		expect(result).toEqual({ compressed: 0, deleted: 0 });
	});

	it("returns zero counts for an empty directory", async () => {
		const dir = await makeDir("empty");
		const result = await rotateLogs(dir);
		expect(result).toEqual({ compressed: 0, deleted: 0 });
	});

	it("applies sensible defaults when no options are provided", async () => {
		const dir = await makeDir("defaults");
		await writeLog(dir, "app.log", "data");
		const result = await rotateLogs(dir);
		expect(result.compressed).toBe(0);
		expect(result.deleted).toBe(0);
	});
});
