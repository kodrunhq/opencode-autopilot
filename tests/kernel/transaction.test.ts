import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { withTransaction } from "../../src/kernel/transaction";

describe("withTransaction", () => {
	let testDbPath: string;
	let db: Database;

	beforeEach(() => {
		testDbPath = join(process.cwd(), ".opencode", "test-transaction.db");
		try {
			unlinkSync(testDbPath);
		} catch (_e) {}

		db = new Database(testDbPath);
		db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
	});

	afterEach(() => {
		if (db) {
			db.close();
		}
		try {
			unlinkSync(testDbPath);
		} catch (_e) {}
	});

	it("should execute successful transaction", () => {
		const result = withTransaction(db, () => {
			db.run("INSERT INTO test (value) VALUES ('hello')");
			return "success";
		});

		expect(result).toBe("success");
		const count = db.query("SELECT COUNT(*) as count FROM test").get() as { count: number };
		expect(count.count).toBe(1);
	});

	it("should rollback on error", () => {
		expect(() => {
			withTransaction(db, () => {
				db.run("INSERT INTO test (value) VALUES ('hello')");
				throw new Error("test error");
			});
		}).toThrow("test error");

		const count = db.query("SELECT COUNT(*) as count FROM test").get() as { count: number };
		expect(count.count).toBe(0);
	});

	it("should retry on SQLITE_BUSY", async () => {
		const db2 = new Database(testDbPath);
		db2.run("PRAGMA journal_mode=WAL");
		db.run("PRAGMA journal_mode=WAL");

		let calls = 0;
		const originalRun = db.run;
		db.run = function (this: unknown, ...args: any[]) {
			if (args[0] === "BEGIN IMMEDIATE") {
				calls++;
				if (calls < 3) {
					throw new Error("database is locked");
				}
			}
			return originalRun.apply(db, args as any);
		} as any;

		const result = withTransaction(
			db,
			() => {
				originalRun.call(db, "INSERT INTO test (value) VALUES ('retry')");
				return "done";
			},
			{ maxRetries: 3, backoffMs: 1 },
		);

		expect(result).toBe("done");
		expect(calls).toBe(3);

		db.run = originalRun;
		db2.close();
	});

	it("should fail after max retries", () => {
		let calls = 0;
		const originalRun = db.run;
		db.run = function (this: unknown, ...args: any[]) {
			if (args[0] === "BEGIN IMMEDIATE") {
				calls++;
				throw new Error("database is locked");
			}
			return originalRun.apply(db, args as any);
		} as any;

		expect(() => {
			withTransaction(
				db,
				() => {
					return "done";
				},
				{ maxRetries: 2, backoffMs: 1 },
			);
		}).toThrow("database is locked");

		expect(calls).toBe(3);

		db.run = originalRun;
	});
});
