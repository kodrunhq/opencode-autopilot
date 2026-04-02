import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pruneOldLogs } from "../../src/observability/retention";

describe("pruneOldLogs", () => {
	let logsDir: string;

	beforeEach(async () => {
		logsDir = join(tmpdir(), `retention-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(logsDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(logsDir, { recursive: true, force: true });
	});

	test("removes log files older than the configured retention period", async () => {
		// Create a file and backdate it to 40 days ago
		const oldFile = join(logsDir, "old-session.jsonl");
		await writeFile(oldFile, '{"type":"error"}\n', "utf-8");

		const { utimes } = await import("node:fs/promises");
		const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
		await utimes(oldFile, fortyDaysAgo, fortyDaysAgo);

		const result = await pruneOldLogs({ logsDir, retentionDays: 30 });
		expect(result.pruned).toBe(1);

		const remaining = await readdir(logsDir);
		expect(remaining).not.toContain("old-session.jsonl");
	});

	test("preserves log files within the retention period", async () => {
		// Create a recent file (today)
		const recentFile = join(logsDir, "recent-session.jsonl");
		await writeFile(recentFile, '{"type":"error"}\n', "utf-8");

		const result = await pruneOldLogs({ logsDir, retentionDays: 30 });
		expect(result.pruned).toBe(0);

		const remaining = await readdir(logsDir);
		expect(remaining).toContain("recent-session.jsonl");
	});

	test("handles empty logs directory gracefully", async () => {
		const result = await pruneOldLogs({ logsDir, retentionDays: 30 });
		expect(result.pruned).toBe(0);
	});

	test("handles missing logs directory gracefully", async () => {
		const missingDir = join(logsDir, "nonexistent-dir");
		const result = await pruneOldLogs({ logsDir: missingDir, retentionDays: 30 });
		expect(result.pruned).toBe(0);
	});

	test("returns count of pruned files", async () => {
		const { utimes } = await import("node:fs/promises");
		const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

		// Create 3 old files
		for (const name of ["a.jsonl", "b.jsonl", "c.jsonl"]) {
			const filePath = join(logsDir, name);
			await writeFile(filePath, '{"type":"error"}\n', "utf-8");
			await utimes(filePath, sixtyDaysAgo, sixtyDaysAgo);
		}

		// Create 1 recent file
		await writeFile(join(logsDir, "recent.jsonl"), '{"type":"error"}\n', "utf-8");

		const result = await pruneOldLogs({ logsDir, retentionDays: 30 });
		expect(result.pruned).toBe(3);

		const remaining = await readdir(logsDir);
		expect(remaining.length).toBe(1);
		expect(remaining).toContain("recent.jsonl");
	});

	test("defaults to 30 days retention when no config provided", async () => {
		const { utimes } = await import("node:fs/promises");

		// Create a file 31 days old (should be pruned with default 30-day retention)
		const oldFile = join(logsDir, "thirty-one-days.jsonl");
		await writeFile(oldFile, '{"type":"error"}\n', "utf-8");
		const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
		await utimes(oldFile, thirtyOneDaysAgo, thirtyOneDaysAgo);

		// Create a file 29 days old (should be preserved)
		const newFile = join(logsDir, "twenty-nine-days.jsonl");
		await writeFile(newFile, '{"type":"error"}\n', "utf-8");
		const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
		await utimes(newFile, twentyNineDaysAgo, twentyNineDaysAgo);

		const result = await pruneOldLogs({ logsDir });
		expect(result.pruned).toBe(1);

		const remaining = await readdir(logsDir);
		expect(remaining).toContain("twenty-nine-days.jsonl");
		expect(remaining).not.toContain("thirty-one-days.jsonl");
	});
});
