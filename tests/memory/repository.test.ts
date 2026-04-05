import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import {
	deleteObservation,
	deletePreferenceRecord,
	deletePreferencesByKey,
	getAllPreferences,
	getConfirmedPreferencesForProject,
	getObservationsByProject,
	getProjectByPath,
	insertObservation,
	listPreferenceEvidence,
	listPreferenceRecords,
	listRelevantLessons,
	prunePreferenceEvidence,
	prunePreferences,
	searchObservations,
	updateAccessCount,
	upsertPreference,
	upsertPreferenceRecord,
	upsertProject,
} from "../../src/memory/repository";

describe("repository", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
		db.run(
			`CREATE TABLE IF NOT EXISTS project_lessons (
				lesson_id INTEGER PRIMARY KEY AUTOINCREMENT,
				project_id TEXT NOT NULL,
				content TEXT NOT NULL,
				domain TEXT NOT NULL,
				extracted_at TEXT NOT NULL,
				source_phase TEXT NOT NULL,
				last_updated_at TEXT,
				FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
				UNIQUE(project_id, extracted_at, domain, source_phase, content)
			)`,
		);
	});

	afterEach(() => {
		db.close();
	});

	const validObs = {
		projectId: "proj-1",
		sessionId: "sess-1",
		type: "decision" as const,
		content: "Use SQLite for storage",
		summary: "Chose SQLite",
		confidence: 0.9,
		accessCount: 0,
		createdAt: "2026-01-01T00:00:00Z",
		lastAccessed: "2026-01-01T00:00:00Z",
	};

	describe("insertObservation", () => {
		test("stores and returns observation with generated id", () => {
			// First upsert the project so FK constraint is met
			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			const result = insertObservation(validObs, db);
			expect(result.id).toBeNumber();
			expect(result.content).toBe("Use SQLite for storage");
			expect(result.type).toBe("decision");
		});

		test("stores user-level observation with null projectId", () => {
			const result = insertObservation({ ...validObs, projectId: null }, db);
			expect(result.id).toBeNumber();
			expect(result.projectId).toBeNull();
		});

		test("rejects invalid observation type", () => {
			expect(() => insertObservation({ ...validObs, type: "invalid" as "decision" }, db)).toThrow();
		});

		test("rejects empty content", () => {
			expect(() => insertObservation({ ...validObs, content: "" }, db)).toThrow();
		});
	});

	describe("searchObservations", () => {
		test("returns FTS5 results with ftsRank", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			insertObservation(validObs, db);
			insertObservation(
				{
					...validObs,
					content: "PostgreSQL is better for large scale",
					summary: "PostgreSQL scale",
				},
				db,
			);
			insertObservation(
				{
					...validObs,
					content: "SQLite FTS5 provides full text search capabilities",
					summary: "SQLite FTS5",
				},
				db,
			);

			const results = searchObservations("SQLite", "proj-1", 10, db);
			expect(results.length).toBeGreaterThanOrEqual(2);
			for (const r of results) {
				expect(r.ftsRank).toBeNumber();
			}
		});

		test("filters by projectId", () => {
			// Insert with null projectId (user-level)
			insertObservation({ ...validObs, projectId: null, content: "SQLite user-level" }, db);

			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			insertObservation(validObs, db);

			const projectResults = searchObservations("SQLite", "proj-1", 10, db);
			const userResults = searchObservations("SQLite", null, 10, db);

			expect(projectResults.length).toBeGreaterThanOrEqual(1);
			expect(userResults.length).toBeGreaterThanOrEqual(1);
		});

		test("returns empty array for no matches", () => {
			const results = searchObservations("nonexistentterm", null, 10, db);
			expect(results).toEqual([]);
		});
	});

	describe("upsertProject", () => {
		test("creates a project record", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/home/user/project",
					name: "my-project",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			const result = getProjectByPath("/home/user/project", db);
			expect(result).not.toBeNull();
			expect(result?.id).toBe("proj-1");
			expect(result?.name).toBe("my-project");
		});

		test("updates existing project on upsert", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/home/user/project",
					name: "old-name",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			upsertProject(
				{
					id: "proj-1",
					path: "/home/user/project",
					name: "new-name",
					lastUpdated: "2026-01-02T00:00:00Z",
				},
				db,
			);
			const result = getProjectByPath("/home/user/project", db);
			expect(result?.name).toBe("new-name");
		});
	});

	describe("getProjectByPath", () => {
		test("returns null for non-existent path", () => {
			const result = getProjectByPath("/nonexistent", db);
			expect(result).toBeNull();
		});
	});

	describe("getObservationsByProject", () => {
		test("returns observations filtered by project_id", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			insertObservation(validObs, db);
			insertObservation({ ...validObs, projectId: null, content: "User-level obs" }, db);

			const projectObs = getObservationsByProject("proj-1", 50, db);
			expect(projectObs.length).toBe(1);
			expect(projectObs[0].content).toBe("Use SQLite for storage");
		});

		test("returns user-level observations with null projectId", () => {
			insertObservation({ ...validObs, projectId: null, content: "User pref observation" }, db);

			const userObs = getObservationsByProject(null, 50, db);
			expect(userObs.length).toBe(1);
		});

		test("respects limit", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			for (let i = 0; i < 5; i++) {
				insertObservation({ ...validObs, content: `Obs ${i}` }, db);
			}
			const results = getObservationsByProject("proj-1", 2, db);
			expect(results.length).toBe(2);
		});
	});

	describe("upsertPreference / getAllPreferences", () => {
		test("creates and retrieves a preference", () => {
			upsertPreference(
				{
					id: "pref-1",
					key: "editor.theme",
					value: "dark",
					confidence: 0.8,
					sourceSession: "sess-1",
					createdAt: "2026-01-01T00:00:00Z",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			const prefs = getAllPreferences(db);
			expect(prefs.length).toBe(1);
			expect(prefs[0].key).toBe("editor.theme");
			expect(prefs[0].value).toBe("dark");
			expect(prefs[0].scope).toBe("global");
			expect(prefs[0].status).toBe("confirmed");
		});

		test("updates existing preference by key", () => {
			upsertPreference(
				{
					id: "pref-1",
					key: "editor.theme",
					value: "dark",
					confidence: 0.8,
					sourceSession: null,
					createdAt: "2026-01-01T00:00:00Z",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			upsertPreference(
				{
					id: "pref-1",
					key: "editor.theme",
					value: "light",
					confidence: 0.9,
					sourceSession: null,
					createdAt: "2026-01-01T00:00:00Z",
					lastUpdated: "2026-01-02T00:00:00Z",
				},
				db,
			);
			const prefs = getAllPreferences(db);
			expect(prefs.length).toBe(1);
			expect(prefs[0].value).toBe("light");
		});

		test("stores project-scoped preference records with evidence", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);

			const record = upsertPreferenceRecord(
				{
					key: "code_style.indent",
					value: "tabs",
					scope: "project",
					projectId: "proj-1",
					confidence: 0.95,
					sourceSession: "sess-1",
					createdAt: "2026-01-01T00:00:00Z",
					lastUpdated: "2026-01-01T00:00:00Z",
					evidence: [
						{
							sessionId: "sess-1",
							statement: "Use tabs in this repo.",
							confirmed: true,
						},
					],
				},
				db,
			);

			const records = listPreferenceRecords({ scope: "project", projectId: "proj-1" }, db);
			expect(records).toHaveLength(1);
			expect(records[0]?.id).toBe(record.id);
			expect(records[0]?.evidenceCount).toBe(1);

			const evidence = listPreferenceEvidence(record.id, db);
			expect(evidence).toHaveLength(1);
			expect(evidence[0]?.statement).toBe("Use tabs in this repo.");

			const compatPrefs = getAllPreferences(db);
			expect(compatPrefs).toHaveLength(1);
			expect(compatPrefs[0]?.scope).toBe("project");
		});

		test("returns confirmed global and project preferences for retrieval", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);

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

			const prefs = getConfirmedPreferencesForProject("proj-1", db);
			expect(prefs).toHaveLength(2);
			expect(prefs.some((pref) => pref.scope === "global" && pref.key === "editor")).toBe(true);
			expect(
				prefs.some((pref) => pref.scope === "project" && pref.key === "testing.framework"),
			).toBe(true);
		});

		test("deletes a preference record and its evidence", () => {
			const record = upsertPreferenceRecord(
				{
					key: "editor",
					value: "vim",
					scope: "global",
					createdAt: "2026-01-01T00:00:00Z",
					lastUpdated: "2026-01-01T00:00:00Z",
					evidence: [{ statement: "I prefer vim.", confirmed: true }],
				},
				db,
			);

			const result = deletePreferenceRecord(record.id, db);
			expect(result.deletedPreferences).toBe(1);
			expect(result.deletedEvidence).toBe(1);
			expect(listPreferenceRecords({}, db)).toEqual([]);
			expect(getAllPreferences(db)).toEqual([]);
		});

		test("deletes preferences by key within scope", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
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
			upsertPreferenceRecord(
				{
					key: "editor",
					value: "helix",
					scope: "project",
					projectId: "proj-1",
					createdAt: "2026-01-01T00:00:00Z",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);

			const result = deletePreferencesByKey(
				"editor",
				{ scope: "project", projectId: "proj-1" },
				db,
			);
			expect(result.deletedPreferences).toBe(1);
			expect(listPreferenceRecords({ scope: "global" }, db)).toHaveLength(1);
			expect(listPreferenceRecords({ scope: "project", projectId: "proj-1" }, db)).toHaveLength(0);
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
			upsertPreferenceRecord(
				{
					key: "confirmed.pref",
					value: "use bun",
					status: "confirmed",
					scope: "global",
					createdAt: "2025-01-01T00:00:00Z",
					lastUpdated: "2025-01-01T00:00:00Z",
				},
				db,
			);

			const result = prunePreferences({ olderThanDays: 30 }, db);
			expect(result.deletedPreferences).toBe(1);
			expect(listPreferenceRecords({}, db)).toHaveLength(1);
			expect(listPreferenceRecords({}, db)[0]?.key).toBe("confirmed.pref");
		});

		test("prunes old evidence while keeping newest rows", () => {
			const record = upsertPreferenceRecord(
				{
					key: "editor",
					value: "vim",
					scope: "global",
					createdAt: "2026-01-01T00:00:00Z",
					lastUpdated: "2026-01-01T00:00:00Z",
					evidence: [
						{ statement: "I prefer vim.", createdAt: "2025-01-01T00:00:00Z", confirmed: true },
						{
							statement: "Please keep using vim.",
							createdAt: "2026-01-01T00:00:00Z",
							confirmed: true,
						},
					],
				},
				db,
			);

			const result = prunePreferenceEvidence(
				{ olderThanDays: 30, keepLatestPerPreference: 1, status: "any" },
				db,
			);
			expect(result.deletedEvidence).toBe(1);
			const evidence = listPreferenceEvidence(record.id, db);
			expect(evidence).toHaveLength(1);
			expect(evidence[0]?.statement).toContain("keep using vim");
		});
	});

	describe("listRelevantLessons", () => {
		test("returns normalized lessons from kernel tables", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);

			db.run(
				`INSERT INTO project_lessons (
					project_id,
					content,
					domain,
					extracted_at,
					source_phase,
					last_updated_at
				) VALUES (?, ?, ?, ?, ?, ?)`,
				[
					"proj-1",
					"Keep inspection read-only.",
					"review",
					"2026-01-01T00:00:00Z",
					"RETROSPECTIVE",
					"2026-01-01T00:00:00Z",
				],
			);

			const lessons = listRelevantLessons("proj-1", 5, db);
			expect(lessons).toHaveLength(1);
			expect(lessons[0]?.content).toContain("read-only");
		});
	});

	describe("deleteObservation", () => {
		test("removes observation by id", () => {
			insertObservation({ ...validObs, projectId: null }, db);
			const obs = getObservationsByProject(null, 50, db);
			expect(obs.length).toBe(1);

			deleteObservation(obs[0].id ?? "", db);
			const after = getObservationsByProject(null, 50, db);
			expect(after.length).toBe(0);
		});
	});

	describe("updateAccessCount", () => {
		test("increments access_count and updates last_accessed", () => {
			insertObservation({ ...validObs, projectId: null }, db);
			const obs = getObservationsByProject(null, 50, db);
			expect(obs[0].accessCount).toBe(0);

			updateAccessCount(obs[0].id ?? "", db);
			const after = getObservationsByProject(null, 50, db);
			expect(after[0].accessCount).toBe(1);
		});
	});

	describe("FTS5 trigger sync", () => {
		test("insert syncs to FTS via trigger", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/test",
					name: "test",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);
			insertObservation(validObs, db);

			const ftsResults = searchObservations("SQLite", "proj-1", 10, db);
			expect(ftsResults.length).toBe(1);
		});

		test("delete removes from FTS via trigger", () => {
			insertObservation({ ...validObs, projectId: null }, db);
			const obs = getObservationsByProject(null, 50, db);

			deleteObservation(obs[0].id ?? "", db);

			const ftsResults = searchObservations("SQLite", null, 10, db);
			expect(ftsResults.length).toBe(0);
		});
	});
});
