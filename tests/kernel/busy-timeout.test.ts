import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKernelDb } from "../../src/kernel/database";

describe("SQLite busy_timeout configuration", () => {
	let testDir: string;
	let _testDbPath: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `opencode-tests-busy-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		_testDbPath = join(testDir, "kernel.db");
	});

	afterEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch (_e) {}
	});

	it("should set busy_timeout to 5000", () => {
		const db = openKernelDb(testDir);
		const query = db.query("PRAGMA busy_timeout");
		const result = query.get() as { timeout: number };
		expect(result.timeout).toBe(5000);
		db.close();
	});
});
