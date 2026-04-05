import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runKernelMigrations } from "../../src/kernel/migrations";
import { delegateCore, ocDelegate } from "../../src/tools/delegate";

describe("delegateCore", () => {
	test("uses explicit category when provided", async () => {
		const result = JSON.parse(
			await delegateCore("write release notes", "writing", undefined, { spawn: false }),
		);
		expect(result.category).toBe("writing");
		expect(result.confidence).toBe(1);
		expect(result.suggestedModelGroup).toBe("communicators");
	});

	test("auto-classifies when category is omitted", async () => {
		const result = JSON.parse(
			await delegateCore("add dark mode toggle to settings page", undefined, undefined, {
				spawn: false,
			}),
		);
		expect(result.category).toBe("visual-engineering");
		expect(result.suggestedModelGroup).toBe("builders");
		expect(result.suggestedSkills).toContain("frontend-design");
	});

	test("returns error for invalid categories", async () => {
		const result = JSON.parse(
			await delegateCore("do work", "invalid-category", undefined, { spawn: false }),
		);
		expect(result.action).toBe("error");
	});

	test("returns error for empty task", async () => {
		const result = JSON.parse(await delegateCore("", undefined, undefined, { spawn: false }));
		expect(result.action).toBe("error");
		expect(result.message).toBe("Task is required.");
	});

	test("returns routing_only when spawn is false", async () => {
		const result = JSON.parse(
			await delegateCore("fix a typo in readme", undefined, undefined, { spawn: false }),
		);
		expect(result.action).toBe("routing_only");
		expect(result.taskId).toBeUndefined();
	});
});

describe("delegateCore with background spawn", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		db.run("PRAGMA foreign_keys=ON");
		db.run("PRAGMA busy_timeout=5000");
		db.run("PRAGMA journal_mode=WAL");
		runKernelMigrations(db);
	});

	afterEach(() => {
		db.close();
	});

	test("spawns background task and returns taskId", async () => {
		const result = JSON.parse(
			await delegateCore("implement auth system", undefined, db, {
				sessionId: "test-session",
				spawn: true,
			}),
		);
		expect(result.action).toBe("delegated");
		expect(result.taskId).toBeDefined();
		expect(typeof result.taskId).toBe("string");
		expect(result.category).toBeDefined();
		expect(result.suggestedModelGroup).toBeDefined();
	});

	test("spawned task is persisted in database", async () => {
		const result = JSON.parse(
			await delegateCore("fix login bug", "quick", db, {
				sessionId: "test-session",
				spawn: true,
			}),
		);
		const taskRow = db.query("SELECT * FROM background_tasks WHERE id = ?").get(result.taskId) as {
			id: string;
			category: string;
			session_id: string;
			model: string | null;
		} | null;
		expect(taskRow).not.toBeNull();
		expect(taskRow?.category).toBe("quick");
		expect(taskRow?.session_id).toBe("test-session");
	});

	test("spawned task passes model group from routing decision", async () => {
		const result = JSON.parse(
			await delegateCore("design UI", "visual-engineering", db, {
				sessionId: "test-session",
				spawn: true,
			}),
		);
		const taskRow = db.query("SELECT * FROM background_tasks WHERE id = ?").get(result.taskId) as {
			id: string;
			model: string | null;
		} | null;
		expect(taskRow).not.toBeNull();
		expect(taskRow?.model).toBe("builders");
	});

	test("displayText includes task ID when spawned", async () => {
		const result = JSON.parse(
			await delegateCore("write docs", "writing", db, {
				sessionId: "test-session",
				spawn: true,
			}),
		);
		expect(result.displayText).toContain("Background task ID:");
		expect(result.displayText).toContain(result.taskId);
	});

	test("explicit category with spawn creates correct task", async () => {
		const result = JSON.parse(
			await delegateCore("design UI", "visual-engineering", db, {
				sessionId: "test-session",
				spawn: true,
			}),
		);
		expect(result.action).toBe("delegated");
		expect(result.category).toBe("visual-engineering");
		expect(result.taskId).toBeDefined();
	});
});

describe("ocDelegate tool", () => {
	test("is defined", () => {
		expect(ocDelegate).toBeDefined();
	});
});
