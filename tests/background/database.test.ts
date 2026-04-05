import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTask, getTaskById } from "../../src/background/repository";
import { openKernelDb } from "../../src/kernel/database";

describe("background database schema", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "background-db-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("creates background_tasks table during kernel migration", () => {
		const db = openKernelDb(tempDir);
		try {
			const row = db
				.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'background_tasks'")
				.get() as { name?: string } | null;
			expect(row?.name).toBe("background_tasks");
		} finally {
			db.close();
		}
	});

	test("supports background task CRUD via repository", () => {
		const db = openKernelDb(tempDir);
		try {
			const created = createTask(db, {
				sessionId: "session-1",
				description: "index repository",
				category: "maintenance",
				agent: "oc-explorer",
				priority: 80,
			});

			expect(created.id).toBeString();
			expect(created.status).toBe("pending");
			expect(created.category).toBe("maintenance");

			const fetched = getTaskById(db, created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.description).toBe("index repository");
			expect(fetched?.agent).toBe("oc-explorer");
		} finally {
			db.close();
		}
	});
});
