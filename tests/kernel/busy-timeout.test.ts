import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { openKernelDb } from "../../src/kernel/database";

describe("SQLite busy_timeout configuration", () => {
	let testDbPath: string;

	beforeEach(() => {
		testDbPath = join(process.cwd(), ".opencode", "test-busy-timeout.db");
		try {
			unlinkSync(testDbPath);
		} catch (_e) {}
	});

	afterEach(() => {
		try {
			unlinkSync(testDbPath);
		} catch (_e) {}
	});

	it("should set busy_timeout to 5000", () => {
		const db = openKernelDb(process.cwd());
		const query = db.query("PRAGMA busy_timeout");
		const result = query.get() as { timeout: number };
		expect(result.timeout).toBe(5000);
		db.close();
	});
});
