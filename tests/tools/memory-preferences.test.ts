import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { upsertPreferenceRecord, upsertProject } from "../../src/memory/repository";
import { memoryPreferencesCore, ocMemoryPreferences } from "../../src/tools/memory-preferences";

describe("memoryPreferencesCore", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("deletes a global preference by key", () => {
		upsertPreferenceRecord(
			{
				key: "editor",
				value: "vim",
				scope: "global",
				createdAt: "2026-01-01T00:00:00Z",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);

		const result = JSON.parse(
			memoryPreferencesCore(
				{ subcommand: "delete", key: "editor", scope: "global" },
				"/tmp/project",
				db,
			),
		);

		expect(result.ok).toBe(true);
		expect(result.result.deletedPreferences).toBe(1);
	});

	test("deletes project preference by key using current project resolution", () => {
		upsertProject(
			{ id: "proj-1", path: "/tmp/project", name: "project", lastUpdated: "2026-01-01T00:00:00Z" },
			db,
		);
		upsertPreferenceRecord(
			{
				key: "testing.framework",
				value: "bun:test",
				scope: "project",
				projectId: "proj-1",
				createdAt: "2026-01-01T00:00:00Z",
				lastUpdated: "2026-01-01T00:00:00Z",
			},
			db,
		);

		const result = JSON.parse(
			memoryPreferencesCore(
				{ subcommand: "delete", key: "testing.framework", scope: "project" },
				"/tmp/project",
				db,
			),
		);

		expect(result.ok).toBe(true);
		expect(result.result.deletedPreferences).toBe(1);
	});

	test("prunes old unconfirmed preferences", () => {
		upsertPreferenceRecord(
			{
				key: "candidate.pref",
				value: "maybe use yarn",
				status: "candidate",
				scope: "global",
				createdAt: "2025-01-01T00:00:00Z",
				lastUpdated: "2025-01-01T00:00:00Z",
			},
			db,
		);

		const result = JSON.parse(
			memoryPreferencesCore(
				{ subcommand: "prune", olderThanDays: 30, scope: "global", status: "unconfirmed" },
				"/tmp/project",
				db,
			),
		);

		expect(result.ok).toBe(true);
		expect(result.result.deletedPreferences).toBe(1);
	});
});

describe("ocMemoryPreferences tool", () => {
	test("is defined", () => {
		expect(ocMemoryPreferences).toBeDefined();
	});
});
