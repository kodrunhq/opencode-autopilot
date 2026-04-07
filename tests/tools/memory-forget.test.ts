import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { saveMemory } from "../../src/memory/memories";
import { memoryForgetCore, ocMemoryForget } from "../../src/tools/memory-forget";

describe("memoryForgetCore", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("forgets an active memory by textId", () => {
		const memory = saveMemory(
			{
				kind: "preference",
				content: "User prefers dark theme for all editors",
				summary: "Dark theme preference",
				scope: "user",
			},
			db,
		);

		const result = memoryForgetCore({ textId: memory.textId }, db);

		expect(result.ok).toBe(true);
		expect(result.forgotten).toBe(true);
		expect(result.memory?.textId).toBe(memory.textId);
		expect(result.memory?.kind).toBe("preference");
	});

	test("returns error for non-existent textId", () => {
		const result = memoryForgetCore({ textId: "nonexistent-id" }, db);

		expect(result.ok).toBe(false);
		expect(result.forgotten).toBe(false);
		expect(result.error).toContain("not found");
	});

	test("returns error for already-rejected memory", () => {
		const memory = saveMemory(
			{
				kind: "preference",
				content: "User prefers light theme for all editors",
				summary: "Light theme preference",
				scope: "user",
			},
			db,
		);

		memoryForgetCore({ textId: memory.textId }, db);
		const result = memoryForgetCore({ textId: memory.textId }, db);

		expect(result.ok).toBe(false);
		expect(result.error).toContain("already");
	});
});

describe("ocMemoryForget tool", () => {
	test("is defined", () => {
		expect(ocMemoryForget).toBeDefined();
	});
});
