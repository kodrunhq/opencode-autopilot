import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createMemoryCaptureHandler, type MemoryCaptureDeps } from "../../src/memory/capture";
import { initMemoryDb } from "../../src/memory/database";

function createTestDeps(db: Database): MemoryCaptureDeps {
	return {
		getDb: () => db,
		projectRoot: "/home/user/my-project",
	};
}

describe("Memory Capture Concurrency", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	it("handles concurrent event writes safely without deadlocks", async () => {
		const handler = createMemoryCaptureHandler(createTestDeps(db));
		const sessionId = "sess-concurrent";

		await handler({
			event: {
				type: "session.created",
				properties: {
					info: { id: sessionId },
				},
			},
		});

		const errors = Array.from({ length: 10 }).map((_, i) => {
			return new Promise<void>((resolve) => {
				setTimeout(async () => {
					await handler({
						event: {
							type: "session.error",
							properties: {
								sessionID: sessionId,
								error: new Error(`Concurrent error ${i}`),
							},
						},
					});
					resolve();
				}, Math.random() * 10);
			});
		});

		await Promise.all(errors);

		const observations = db
			.query("SELECT * FROM observations WHERE session_id = ?")
			.all(sessionId) as Array<{ type: string }>;

		expect(observations.length).toBe(10);
		expect(observations.every((observation) => observation.type === "error")).toBe(true);
	});
});
