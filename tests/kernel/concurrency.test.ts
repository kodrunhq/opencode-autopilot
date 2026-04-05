import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKernelDb } from "../../src/kernel/database";
import { withTransaction } from "../../src/kernel/transaction";

describe("Kernel DB Concurrency", () => {
	let tempDir: string;
	let _testDbPath: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "kernel-concurrency-"));
		_testDbPath = join(tempDir, "kernel.db");
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch (_e) {}
	});

	it("should handle 100 concurrent writes to pipeline_runs", async () => {
		const db = openKernelDb(tempDir);

		const projectId = `test-project-${Date.now()}`;
		db.run(
			"INSERT INTO projects (id, path, name, first_seen_at, last_updated) VALUES (?, ?, ?, ?, ?)",
			[projectId, tempDir, "test project", new Date().toISOString(), new Date().toISOString()],
		);

		const writes = Array.from({ length: 100 }).map((_, i) => {
			return new Promise<boolean>((resolve) => {
				setTimeout(() => {
					try {
						withTransaction(db, () => {
							db.run(
								`INSERT INTO pipeline_runs (
									project_id, run_id, schema_version, status, idea, state_revision, started_at, last_updated_at, state_json
								) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
								[
									projectId,
									`run-${i}`,
									1,
									"pending",
									"test idea",
									1,
									new Date().toISOString(),
									new Date().toISOString(),
									"{}",
								],
							);
						});
						resolve(true);
					} catch (e) {
						console.error(`Write ${i} failed:`, e);
						resolve(false);
					}
				}, Math.random() * 50);
			});
		});

		const results = await Promise.all(writes);

		expect(results.every((r) => r === true)).toBe(true);

		const countRow = db.query("SELECT COUNT(*) as count FROM pipeline_runs").get() as {
			count: number;
		};
		expect(countRow.count).toBe(100);

		db.close();
	});
});
