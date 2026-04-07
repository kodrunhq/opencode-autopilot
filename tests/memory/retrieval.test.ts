import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { runKernelMigrations } from "../../src/kernel/migrations";
import { CHARS_PER_TOKEN } from "../../src/memory/constants";
import { initMemoryDb } from "../../src/memory/database";
import { saveMemory } from "../../src/memory/memories";
import {
	insertObservation,
	upsertPreferenceRecord,
	upsertProject,
} from "../../src/memory/repository";
import {
	buildMemoryContext,
	buildMemoryContextV2,
	retrieveMemoryContext,
	retrieveMemoryContextV2,
	type ScoredObservation,
	scoreAndRankObservations,
} from "../../src/memory/retrieval";
import type { Observation, Preference } from "../../src/memory/types";

function makeObservation(
	overrides: Partial<Omit<Observation, "id">> = {},
): Omit<Observation, "id"> {
	return {
		projectId: "test-project",
		sessionId: "session-1",
		type: "decision",
		content: "Use repository pattern for data access layer",
		summary: "Repository pattern for data access",
		confidence: 0.8,
		accessCount: 0,
		createdAt: new Date().toISOString(),
		lastAccessed: new Date().toISOString(),
		...overrides,
	};
}

function makeScoredObs(overrides: Partial<ScoredObservation> = {}): ScoredObservation {
	return {
		id: 1,
		projectId: "test-project",
		sessionId: "session-1",
		type: "error",
		content: "Use repository pattern for data access layer",
		summary: "Repository pattern for data access",
		confidence: 0.8,
		accessCount: 0,
		createdAt: new Date().toISOString(),
		lastAccessed: new Date().toISOString(),
		relevanceScore: 1.5,
		...overrides,
	};
}

const emptyPrefs: readonly Preference[] = [];

describe("scoreAndRankObservations", () => {
	it("returns ScoredObservation with relevanceScore", () => {
		const obs: Observation[] = [{ ...makeObservation(), id: 1 } as Observation];
		const scored = scoreAndRankObservations(obs);
		expect(scored.length).toBe(1);
		expect(typeof scored[0].relevanceScore).toBe("number");
		expect(scored[0].relevanceScore).toBeGreaterThan(0);
	});

	it("sorts descending by relevanceScore", () => {
		const obs: Observation[] = [
			{ ...makeObservation({ type: "tool_usage" }), id: 1 } as Observation,
			{ ...makeObservation({ type: "decision" }), id: 2 } as Observation,
		];
		const scored = scoreAndRankObservations(obs);
		expect(scored[0].relevanceScore).toBeGreaterThanOrEqual(scored[1].relevanceScore);
		expect(scored[0].type).toBe("decision");
	});
});

describe("buildMemoryContext", () => {
	it("returns empty string with no observations and no preferences", () => {
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: null,
			lessons: [],
			preferences: emptyPrefs,
			recentFailures: [],
		});
		expect(result).toBe("");
	});

	it("returns markdown starting with '## Project Memory'", () => {
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			lessons: [],
			preferences: emptyPrefs,
			recentFailures: [makeScoredObs()],
		});
		expect(result).toContain("## Project Memory");
	});

	it("includes project name and last session date in header", () => {
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			lessons: [],
			preferences: emptyPrefs,
			recentFailures: [makeScoredObs()],
		});
		expect(result).toContain("my-project");
		expect(result).toContain("2026-01-01");
	});

	it("shows 'first session' when lastSessionDate is null", () => {
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: null,
			lessons: [],
			preferences: emptyPrefs,
			recentFailures: [makeScoredObs()],
		});
		expect(result).toContain("first session");
	});

	it("renders explicit preference, lesson, and failure sections", () => {
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			preferences: [
				{
					id: "pref-1",
					key: "editor",
					value: "vim",
					confidence: 0.9,
					scope: "project",
					projectId: "test-project",
					status: "confirmed",
					evidenceCount: 2,
					sourceSession: null,
					createdAt: new Date().toISOString(),
					lastUpdated: new Date().toISOString(),
				},
			],
			lessons: [
				{
					content: "Keep inspection read-only.",
					domain: "review",
					extractedAt: "2026-01-01T00:00:00Z",
					sourcePhase: "RETROSPECTIVE",
				},
			],
			recentFailures: [makeScoredObs({ id: 3, type: "error", summary: "Error A" })],
		});

		expect(result).toContain("### Confirmed Project Preferences");
		expect(result).toContain("### Recent Lessons");
		expect(result).toContain("### Failure Avoidance Notes");
	});

	it("respects token budget", () => {
		const failures: ScoredObservation[] = Array.from({ length: 20 }, (_, i) =>
			makeScoredObs({
				id: i + 1,
				summary: `Decision ${i + 1} summary text that is reasonably long`,
			}),
		);

		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			lessons: [],
			preferences: emptyPrefs,
			recentFailures: failures,
			tokenBudget: 100,
		});

		const charBudget = 100 * CHARS_PER_TOKEN;
		expect(result.length).toBeLessThanOrEqual(charBudget);
	});

	it("never exceeds char budget (tokenBudget * CHARS_PER_TOKEN)", () => {
		const failures: ScoredObservation[] = Array.from({ length: 50 }, (_, i) =>
			makeScoredObs({
				id: i + 1,
				type: "error",
				summary: `Observation ${i + 1}: ${"x".repeat(100)}`,
				content: `Full content for observation ${i + 1}: ${"y".repeat(500)}`,
			}),
		);

		const budget = 500;
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			lessons: [],
			preferences: emptyPrefs,
			recentFailures: failures,
			tokenBudget: budget,
		});

		expect(result.length).toBeLessThanOrEqual(budget * CHARS_PER_TOKEN);
	});

	it("includes preferences section when preferences are provided", () => {
		const prefs: Preference[] = [
			{
				id: "pref-1",
				key: "preferred_language",
				value: "TypeScript",
				confidence: 0.9,
				scope: "global",
				projectId: null,
				status: "confirmed",
				evidenceCount: 1,
				sourceSession: null,
				createdAt: new Date().toISOString(),
				lastUpdated: new Date().toISOString(),
			},
		];

		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			lessons: [],
			preferences: prefs,
			recentFailures: [makeScoredObs()],
		});

		expect(result).toContain("### Confirmed User Preferences");
		expect(result).toContain("preferred_language");
		expect(result).toContain("TypeScript");
	});

	it("sorts failure observations by relevance score", () => {
		const failures: ScoredObservation[] = [
			makeScoredObs({ id: 1, type: "error", summary: "Low priority", relevanceScore: 0.5 }),
			makeScoredObs({ id: 2, type: "error", summary: "High priority", relevanceScore: 2.0 }),
		];

		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			lessons: [],
			preferences: emptyPrefs,
			recentFailures: failures,
		});

		const highIdx = result.indexOf("High priority");
		const lowIdx = result.indexOf("Low priority");
		expect(highIdx).toBeLessThan(lowIdx);
	});

	it("includes lesson content when present", () => {
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			lessons: [
				{
					content: "Prefer read-only inspection paths.",
					domain: "architecture",
					extractedAt: "2026-01-01T00:00:00Z",
					sourcePhase: "RETROSPECTIVE",
				},
			],
			preferences: emptyPrefs,
			recentFailures: [],
		});

		expect(result).toContain("Prefer read-only inspection paths.");
	});
});

describe("ScoredObservation type", () => {
	it("includes observation fields plus relevanceScore", () => {
		const scored: ScoredObservation = makeScoredObs();
		expect(scored.id).toBeDefined();
		expect(scored.projectId).toBeDefined();
		expect(scored.type).toBeDefined();
		expect(scored.content).toBeDefined();
		expect(scored.summary).toBeDefined();
		expect(scored.relevanceScore).toBeDefined();
	});
});

describe("retrieveMemoryContext access-count integration", () => {
	let db: Database;

	afterEach(() => {
		try {
			db.close();
		} catch {
			// already closed
		}
	});

	it("increments access_count for retrieved observations", () => {
		db = new Database(":memory:");
		initMemoryDb(db);
		runKernelMigrations(db);

		const testPath = "/tmp/test-project-access-count";
		const projectId = "proj-access-test";
		const now = new Date().toISOString();

		upsertProject({ id: projectId, path: testPath, name: "access-test", lastUpdated: now }, db);

		upsertPreferenceRecord(
			{
				key: "editor",
				value: "vim",
				scope: "project",
				projectId,
				createdAt: now,
				lastUpdated: now,
			},
			db,
		);

		insertObservation(
			{
				projectId,
				sessionId: "sess-1",
				type: "error",
				content: "Avoid nested transactions during project resolution",
				summary: "Nested transaction failure",
				confidence: 0.8,
				accessCount: 0,
				createdAt: now,
				lastAccessed: now,
			},
			db,
		);

		const ctx = retrieveMemoryContext(testPath, 2000, db);
		expect(ctx).toContain("Nested transaction failure");
		expect(ctx).toContain("editor");

		const row = db
			.query("SELECT access_count FROM observations WHERE project_id = ?")
			.get(projectId) as { access_count: number };
		expect(row.access_count).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// V2 retrieval tests
// ---------------------------------------------------------------------------

describe("buildMemoryContextV2", () => {
	it("returns memory instructions block when no memories exist", () => {
		const result = buildMemoryContextV2({
			projectName: "my-project",
			lastSessionDate: null,
			projectMemories: [],
			userMemories: [],
		});
		expect(result).toContain("Memory Instructions");
		expect(result).toContain("oc_memory_save");
	});

	it("renders project header with name and session date", () => {
		const mem = makeFakeMemory({ kind: "preference", summary: "Use tabs" });
		const result = buildMemoryContextV2({
			projectName: "my-app",
			lastSessionDate: "2026-03-01",
			projectMemories: [mem],
			userMemories: [],
		});
		expect(result).toContain("my-app");
		expect(result).toContain("2026-03-01");
	});

	it("groups memories by kind with correct section headers", () => {
		const pref = makeFakeMemory({ kind: "preference", summary: "Always use Biome" });
		const mistake = makeFakeMemory({ kind: "mistake", summary: "Never use var" });
		const result = buildMemoryContextV2({
			projectName: "proj",
			lastSessionDate: null,
			projectMemories: [pref, mistake],
			userMemories: [],
		});
		expect(result).toContain("### Preferences");
		expect(result).toContain("### Mistakes to Avoid");
		expect(result).toContain("Always use Biome");
		expect(result).toContain("Never use var");
	});

	it("marks user-scoped memories with _(user-wide)_", () => {
		const userMem = makeFakeMemory({ kind: "preference", summary: "Dark mode", scope: "user" });
		const result = buildMemoryContextV2({
			projectName: "proj",
			lastSessionDate: null,
			projectMemories: [],
			userMemories: [userMem],
		});
		expect(result).toContain("_(user-wide)_");
	});

	it("respects token budget and truncates", () => {
		const mems = Array.from({ length: 100 }, (_, i) =>
			makeFakeMemory({ kind: "preference", summary: `Preference ${i} ${"x".repeat(80)}` }),
		);
		const result = buildMemoryContextV2({
			projectName: "proj",
			lastSessionDate: null,
			projectMemories: mems,
			userMemories: [],
			tokenBudget: 200,
		});
		expect(result.length).toBeLessThanOrEqual(200 * CHARS_PER_TOKEN);
	});

	it("displays mistakes before preferences (weight ordering)", () => {
		const pref = makeFakeMemory({ kind: "preference", summary: "Use Biome" });
		const mistake = makeFakeMemory({ kind: "mistake", summary: "Avoid console.log" });
		const result = buildMemoryContextV2({
			projectName: "proj",
			lastSessionDate: null,
			projectMemories: [pref, mistake],
			userMemories: [],
		});
		const mistakeIdx = result.indexOf("Mistakes to Avoid");
		const prefIdx = result.indexOf("Preferences");
		expect(mistakeIdx).toBeLessThan(prefIdx);
	});
});

describe("retrieveMemoryContextV2", () => {
	let db: Database;

	afterEach(() => {
		try {
			db.close();
		} catch {
			// already closed
		}
	});

	it("returns memory instructions even with no project or memories", () => {
		db = new Database(":memory:");
		initMemoryDb(db);
		runKernelMigrations(db);

		const result = retrieveMemoryContextV2("/tmp/nonexistent-project", 2000, db);
		expect(result).toContain("Memory Instructions");
	});

	it("retrieves memories for an existing project", () => {
		db = new Database(":memory:");
		initMemoryDb(db);
		runKernelMigrations(db);

		const projectPath = "/tmp/test-v2-retrieval";
		const projectId = "proj-v2-test";
		const now = new Date().toISOString();

		upsertProject({ id: projectId, path: projectPath, name: "v2-test", lastUpdated: now }, db);

		saveMemory(
			{
				kind: "decision",
				content: "Use PostgreSQL for the main database",
				summary: "PostgreSQL as main DB",
				projectId,
				scope: "project",
			},
			db,
		);

		const result = retrieveMemoryContextV2(projectPath, 2000, db);
		expect(result).toContain("PostgreSQL as main DB");
		expect(result).toContain("### Decisions");
	});

	it("bumps access_count for retrieved memories", () => {
		db = new Database(":memory:");
		initMemoryDb(db);
		runKernelMigrations(db);

		const projectPath = "/tmp/test-v2-access";
		const projectId = "proj-v2-access";
		const now = new Date().toISOString();

		upsertProject({ id: projectId, path: projectPath, name: "v2-access", lastUpdated: now }, db);

		saveMemory(
			{
				kind: "preference",
				content: "Always use strict TypeScript",
				summary: "Strict TS mode",
				projectId,
				scope: "project",
			},
			db,
		);

		retrieveMemoryContextV2(projectPath, 2000, db);

		const row = db
			.query("SELECT access_count FROM memories WHERE project_id = ?")
			.get(projectId) as { access_count: number };
		expect(row.access_count).toBeGreaterThanOrEqual(1);
	});
});

function makeFakeMemory(
	overrides: Partial<{
		kind: "preference" | "decision" | "project_fact" | "mistake" | "workflow_rule";
		summary: string;
		scope: "project" | "user";
		content: string;
	}> = {},
) {
	const kind = overrides.kind ?? "preference";
	const scope = overrides.scope ?? "project";
	return {
		id: Math.floor(Math.random() * 100000),
		textId: `mem-${Math.random().toString(36).slice(2)}`,
		projectId: null,
		kind,
		scope,
		content: overrides.content ?? `Content for ${overrides.summary ?? "test memory"}`,
		summary: overrides.summary ?? "Test memory",
		reasoning: null,
		confidence: 0.8,
		evidenceCount: 1,
		tags: [] as string[],
		sourceSession: null,
		status: "active" as const,
		supersedesMemoryId: null,
		accessCount: 0,
		createdAt: new Date().toISOString(),
		lastUpdated: new Date().toISOString(),
		lastAccessed: new Date().toISOString(),
	};
}
