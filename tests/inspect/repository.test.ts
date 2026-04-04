import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	getMemoryOverview,
	getProjectDetails,
	listEvents,
	listLessons,
	listPreferences,
	listProjects,
	listRuns,
} from "../../src/inspect/repository";
import { runKernelMigrations } from "../../src/kernel/migrations";
import { initMemoryDb } from "../../src/memory/database";
import { insertObservation, upsertPreference } from "../../src/memory/repository";
import { createEmptyLessonMemory } from "../../src/orchestrator/lesson-memory";
import { createInitialState } from "../../src/orchestrator/state";
import { resolveProjectIdentitySync } from "../../src/projects/resolve";

describe("inspect repository", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
		runKernelMigrations(db);
	});

	afterEach(() => {
		db.close();
	});

	test("lists projects, runs, events, lessons, preferences, and memory overview", async () => {
		const projectRoot = "/tmp/inspect-project";
		const now = "2026-04-05T12:00:00.000Z";
		const project = resolveProjectIdentitySync(projectRoot, {
			db,
			now: () => now,
			readGitFingerprint: () => null,
			createProjectId: () => "project-1",
		});

		insertObservation(
			{
				projectId: project.id,
				sessionId: "session-1",
				type: "decision",
				content: "Use project-aware storage",
				summary: "project-aware storage",
				confidence: 0.9,
				accessCount: 0,
				createdAt: now,
				lastAccessed: now,
			},
			db,
		);

		upsertPreference(
			{
				id: "pref-1",
				key: "editor",
				value: "vim",
				confidence: 0.95,
				sourceSession: "session-1",
				createdAt: now,
				lastUpdated: now,
			},
			db,
		);

		const state = createInitialState("inspect feature");
		db.run(
			`INSERT INTO pipeline_runs (
				project_id,
				run_id,
				schema_version,
				status,
				current_phase,
				idea,
				state_revision,
				started_at,
				last_updated_at,
				failure_phase,
				failure_agent,
				failure_message,
				last_successful_phase,
				state_json
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				project.id,
				state.runId,
				state.schemaVersion,
				state.status,
				state.currentPhase,
				state.idea,
				state.stateRevision,
				state.startedAt,
				state.lastUpdatedAt,
				null,
				null,
				null,
				null,
				JSON.stringify(state),
			],
		);

		db.run(
			`INSERT INTO forensic_events (
				project_id,
				schema_version,
				timestamp,
				project_root,
				domain,
				run_id,
				session_id,
				parent_session_id,
				phase,
				dispatch_id,
				task_id,
				agent,
				type,
				code,
				message,
				payload_json
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				project.id,
				1,
				now,
				projectRoot,
				"session",
				state.runId,
				"session-1",
				null,
				"RECON",
				null,
				null,
				"oc-researcher",
				"decision",
				null,
				"decision recorded",
				JSON.stringify({ decision: "Use project-aware storage", rationale: "safer" }),
			],
		);

		db.run(
			`INSERT INTO project_lesson_memory (project_id, schema_version, last_updated_at, state_json)
			 VALUES (?, ?, ?, ?)`,
			[
				project.id,
				1,
				now,
				JSON.stringify({
					...createEmptyLessonMemory(),
					lessons: [
						{
							content: "Keep inspection read-only.",
							domain: "review",
							extractedAt: now,
							sourcePhase: "RETROSPECTIVE",
						},
					],
					lastUpdatedAt: now,
				}),
			],
		);

		const projects = listProjects(db);
		expect(projects).toHaveLength(1);
		expect(projects[0]?.id).toBe(project.id);
		expect(projects[0]?.runCount).toBe(1);
		expect(projects[0]?.eventCount).toBe(1);
		expect(projects[0]?.lessonCount).toBe(1);

		const details = getProjectDetails(project.id, db);
		expect(details?.project.path).toBe(projectRoot);
		expect(details?.paths).toHaveLength(1);

		const runs = listRuns({ projectRef: project.id }, db);
		expect(runs).toHaveLength(1);
		expect(runs[0]?.runId).toBe(state.runId);

		const events = listEvents({ projectRef: project.id }, db);
		expect(events).toHaveLength(1);
		expect(events[0]?.sessionId).toBe("session-1");

		const lessons = listLessons({ projectRef: project.id }, db);
		expect(lessons).toHaveLength(1);
		expect(lessons[0]?.content).toContain("inspection");

		const preferences = listPreferences(db);
		expect(preferences).toHaveLength(1);
		expect(preferences[0]?.key).toBe("editor");
		expect(preferences[0]?.scope).toBe("global");
		expect(preferences[0]?.evidence).toHaveLength(1);

		const overview = getMemoryOverview(db);
		expect(overview.stats.totalProjects).toBe(1);
		expect(overview.stats.totalObservations).toBe(1);
		expect(overview.stats.totalPreferences).toBe(1);
		expect(overview.recentObservations).toHaveLength(1);
	});

	test("returns empty results when project reference does not resolve", () => {
		expect(getProjectDetails("missing-project", db)).toBeNull();
		expect(listRuns({ projectRef: "missing-project" }, db)).toEqual([]);
		expect(listEvents({ projectRef: "missing-project" }, db)).toEqual([]);
		expect(listLessons({ projectRef: "missing-project" }, db)).toEqual([]);
	});
});
