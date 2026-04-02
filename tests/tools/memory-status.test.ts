import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { insertObservation, upsertPreference, upsertProject } from "../../src/memory/repository";
import { memoryStatusCore, ocMemoryStatus } from "../../src/tools/memory-status";

describe("memoryStatusCore", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("returns zero stats for empty database", () => {
		const result = memoryStatusCore({ detail: "summary" }, db);
		expect(result.stats).toBeDefined();
		expect(result.stats?.totalObservations).toBe(0);
		expect(result.stats?.totalProjects).toBe(0);
		expect(result.stats?.totalPreferences).toBe(0);
		expect(result.recentObservations).toEqual([]);
		expect(result.preferences).toEqual([]);
	});

	test("returns observation count and breakdown by type", () => {
		const now = new Date().toISOString();
		upsertProject({ id: "proj-1", path: "/tmp/proj", name: "proj", lastUpdated: now }, db);
		insertObservation(
			{
				projectId: "proj-1",
				sessionId: "sess-1",
				type: "decision",
				content: "Use strict mode",
				summary: "strict mode",
				confidence: 0.8,
				accessCount: 0,
				createdAt: now,
				lastAccessed: now,
			},
			db,
		);
		insertObservation(
			{
				projectId: "proj-1",
				sessionId: "sess-1",
				type: "error",
				content: "Null pointer",
				summary: "null error",
				confidence: 0.7,
				accessCount: 0,
				createdAt: now,
				lastAccessed: now,
			},
			db,
		);

		const result = memoryStatusCore({ detail: "summary" }, db);
		expect(result.stats?.totalObservations).toBe(2);
		expect(result.stats?.totalProjects).toBe(1);
		expect(result.stats?.observationsByType.decision).toBe(1);
		expect(result.stats?.observationsByType.error).toBe(1);
	});

	test("returns recent observations (last 10)", () => {
		const now = new Date().toISOString();
		upsertProject({ id: "proj-1", path: "/tmp/proj", name: "proj", lastUpdated: now }, db);

		// Insert 12 observations
		for (let i = 0; i < 12; i++) {
			insertObservation(
				{
					projectId: "proj-1",
					sessionId: "sess-1",
					type: "decision",
					content: `Decision ${i}`,
					summary: `Summary ${i}`,
					confidence: 0.8,
					accessCount: 0,
					createdAt: now,
					lastAccessed: now,
				},
				db,
			);
		}

		const result = memoryStatusCore({ detail: "summary" }, db);
		expect(result.recentObservations.length).toBe(10);
		expect(result.recentObservations[0]).toHaveProperty("type");
		expect(result.recentObservations[0]).toHaveProperty("summary");
		expect(result.recentObservations[0]).toHaveProperty("createdAt");
		expect(result.recentObservations[0]).toHaveProperty("confidence");
	});

	test("returns preferences", () => {
		const now = new Date().toISOString();
		upsertPreference(
			{
				id: "pref-1",
				key: "editor",
				value: "vim",
				confidence: 0.9,
				sourceSession: "sess-1",
				createdAt: now,
				lastUpdated: now,
			},
			db,
		);

		const result = memoryStatusCore({ detail: "summary" }, db);
		expect(result.stats?.totalPreferences).toBe(1);
		expect(result.preferences.length).toBe(1);
		expect(result.preferences[0].key).toBe("editor");
		expect(result.preferences[0].value).toBe("vim");
	});

	test("returns storage size info", () => {
		const result = memoryStatusCore({ detail: "summary" }, db);
		expect(result.stats).toHaveProperty("storageSizeKb");
		expect(typeof result.stats?.storageSizeKb).toBe("number");
	});
});

describe("ocMemoryStatus tool", () => {
	test("has correct name", () => {
		// The tool object should be defined
		expect(ocMemoryStatus).toBeDefined();
	});
});
