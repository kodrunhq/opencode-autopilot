import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKernelDb } from "../../src/kernel/database";
import { withTransaction } from "../../src/kernel/transaction";

const TEST_RUN_INSERT = `INSERT INTO pipeline_runs (
	project_id,
	run_id,
	schema_version,
	status,
	idea,
	state_revision,
	started_at,
	last_updated_at,
	state_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function insertProject(
	db: ReturnType<typeof openKernelDb>,
	projectId: string,
	projectPath: string,
): void {
	const now = new Date().toISOString();
	db.run(
		"INSERT INTO projects (id, path, name, first_seen_at, last_updated) VALUES (?, ?, ?, ?, ?)",
		[projectId, projectPath, "test project", now, now],
	);
}

function insertRun(
	db: ReturnType<typeof openKernelDb>,
	projectId: string,
	runId: string,
	idea: string,
): void {
	const now = new Date().toISOString();
	db.run(TEST_RUN_INSERT, [projectId, runId, 1, "pending", idea, 1, now, now, "{}"]);
}

function countPipelineRuns(db: ReturnType<typeof openKernelDb>): number {
	const row = db.query("SELECT COUNT(*) as count FROM pipeline_runs").get() as { count: number };
	return row.count;
}

describe("Kernel DB Concurrency", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "kernel-concurrency-"));
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch (_e) {}
	});

	it("should handle 100 concurrent writes to pipeline_runs", async () => {
		const db = openKernelDb(tempDir);

		const projectId = `test-project-${Date.now()}`;
		insertProject(db, projectId, tempDir);

		const writes = Array.from({ length: 100 }).map((_, i) => {
			return new Promise<boolean>((resolve) => {
				setTimeout(() => {
					try {
						withTransaction(db, () => {
							insertRun(db, projectId, `run-${i}`, "test idea");
						});
						resolve(true);
					} catch (_error) {
						resolve(false);
					}
				}, Math.random() * 50);
			});
		});

		const results = await Promise.all(writes);

		expect(results.every((result) => result)).toBe(true);
		expect(countPipelineRuns(db)).toBe(100);

		db.close();
	});

	describe("SQLite Contention", () => {
		it("handles parallel inserts with transactions and busy timeout protection", async () => {
			const setupDb = openKernelDb(tempDir);
			const projectId = `contention-project-${Date.now()}`;
			insertProject(setupDb, projectId, tempDir);
			setupDb.close();

			const insertCount = 20;
			const operations = Array.from({ length: insertCount }, (_, index) => {
				return new Promise<{ readonly ok: true } | { readonly ok: false; readonly error: Error }>(
					(resolve) => {
						setTimeout(() => {
							const db = openKernelDb(tempDir);
							try {
								withTransaction(
									db,
									() => {
										insertRun(db, projectId, `contention-run-${index}`, `contention idea ${index}`);
									},
									{ backoffMs: 1, maxRetries: 10 },
								);
								resolve({ ok: true });
							} catch (error: unknown) {
								resolve({
									ok: false,
									error: error instanceof Error ? error : new Error(String(error)),
								});
							} finally {
								db.close();
							}
						}, Math.random() * 25);
					},
				);
			});

			const results = await Promise.all(operations);
			const failures = results.filter(
				(result): result is { readonly ok: false; readonly error: Error } => !result.ok,
			);

			expect(failures).toHaveLength(0);

			const verifyDb = openKernelDb(tempDir);
			expect(countPipelineRuns(verifyDb)).toBe(insertCount);
			verifyDb.close();
		});

		it("preserves every run id written under contention", async () => {
			const setupDb = openKernelDb(tempDir);
			const projectId = `contention-project-ids-${Date.now()}`;
			insertProject(setupDb, projectId, tempDir);
			setupDb.close();

			const runIds = Object.freeze(
				Array.from({ length: 12 }, (_, index) => `contention-preserve-${index}`),
			);

			await Promise.all(
				runIds.map(
					(runId) =>
						new Promise<void>((resolve, reject) => {
							setTimeout(() => {
								const db = openKernelDb(tempDir);
								try {
									withTransaction(
										db,
										() => {
											insertRun(db, projectId, runId, `idea ${runId}`);
										},
										{ backoffMs: 1, maxRetries: 10 },
									);
									resolve();
								} catch (error) {
									reject(error);
								} finally {
									db.close();
								}
							}, Math.random() * 15);
						}),
				),
			);

			const verifyDb = openKernelDb(tempDir, { readonly: true });
			const storedRunIds = (
				verifyDb
					.query("SELECT run_id FROM pipeline_runs WHERE project_id = ? ORDER BY run_id ASC")
					.all(projectId) as Array<{ run_id: string }>
			).map((row) => row.run_id);

			expect(storedRunIds).toEqual([...runIds].sort());
			verifyDb.close();
		});

		it("configures busy_timeout on every concurrent writer connection", () => {
			const dbOne = openKernelDb(tempDir);
			const dbTwo = openKernelDb(tempDir);

			const timeoutOne = dbOne.query("PRAGMA busy_timeout").get() as { timeout: number };
			const timeoutTwo = dbTwo.query("PRAGMA busy_timeout").get() as { timeout: number };

			expect(timeoutOne.timeout).toBe(5000);
			expect(timeoutTwo.timeout).toBe(5000);

			dbOne.close();
			dbTwo.close();
		});

		it("rolls back failed writer transactions without affecting successful writers", async () => {
			const setupDb = openKernelDb(tempDir);
			const projectId = `contention-project-rollback-${Date.now()}`;
			insertProject(setupDb, projectId, tempDir);
			setupDb.close();

			const results = await Promise.all(
				Array.from(
					{ length: 10 },
					(_, index) =>
						new Promise<boolean>((resolve) => {
							const db = openKernelDb(tempDir);
							try {
								withTransaction(
									db,
									() => {
										insertRun(db, projectId, `rollback-run-${index}`, `idea ${index}`);
										if (index % 4 === 0) {
											throw new Error(`fail ${index}`);
										}
									},
									{ backoffMs: 1, maxRetries: 10 },
								);
								resolve(true);
							} catch {
								resolve(false);
							} finally {
								db.close();
							}
						}),
				),
			);

			const expectedSuccesses = results.filter(Boolean).length;
			const verifyDb = openKernelDb(tempDir, { readonly: true });
			const storedCount = (
				verifyDb
					.query("SELECT COUNT(*) as count FROM pipeline_runs WHERE project_id = ?")
					.get(projectId) as { count: number }
			).count;

			expect(expectedSuccesses).toBe(7);
			expect(storedCount).toBe(expectedSuccesses);
			verifyDb.close();
		});

		it("keeps reads isolated from in-flight writes on a separate readonly connection", async () => {
			const writerDb = openKernelDb(tempDir);
			const projectId = `wal-project-${Date.now()}`;
			insertProject(writerDb, projectId, tempDir);

			const readerDb = openKernelDb(tempDir, { readonly: true });
			const txRunIds = Object.freeze(["wal-run-1", "wal-run-2", "wal-run-3"]);

			writerDb.run("BEGIN IMMEDIATE");
			for (const runId of txRunIds) {
				insertRun(writerDb, projectId, runId, `idea ${runId}`);
			}

			const beforeCommit = readerDb
				.query("SELECT COUNT(*) as count FROM pipeline_runs WHERE project_id = ?")
				.get(projectId) as { count: number };

			expect(beforeCommit.count).toBe(0);

			writerDb.run("COMMIT");

			const afterCommit = readerDb
				.query("SELECT COUNT(*) as count FROM pipeline_runs WHERE project_id = ?")
				.get(projectId) as { count: number };

			expect(afterCommit.count).toBe(txRunIds.length);

			const readCounts = await Promise.all(
				Array.from({ length: 12 }, () =>
					Promise.resolve(
						(
							readerDb
								.query("SELECT COUNT(*) as count FROM pipeline_runs WHERE project_id = ?")
								.get(projectId) as { count: number }
						).count,
					),
				),
			);

			expect(readCounts.every((count) => count === 0 || count === txRunIds.length)).toBe(true);

			readerDb.close();
			writerDb.close();
		});

		it("allows readonly readers to observe committed data after writer closes", () => {
			const writerDb = openKernelDb(tempDir);
			const projectId = `wal-project-close-${Date.now()}`;
			insertProject(writerDb, projectId, tempDir);
			withTransaction(writerDb, () => {
				insertRun(writerDb, projectId, "reader-visible-1", "visible after commit");
			});
			writerDb.close();

			const readerDb = openKernelDb(tempDir, { readonly: true });
			const row = readerDb
				.query("SELECT run_id FROM pipeline_runs WHERE project_id = ?")
				.get(projectId) as { run_id: string };

			expect(row.run_id).toBe("reader-visible-1");
			readerDb.close();
		});
	});
});
