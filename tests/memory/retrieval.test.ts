import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { CHARS_PER_TOKEN } from "../../src/memory/constants";
import { initMemoryDb } from "../../src/memory/database";
import { insertObservation, upsertProject } from "../../src/memory/repository";
import {
	buildMemoryContext,
	retrieveMemoryContext,
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
		type: "decision",
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
			observations: [],
			preferences: emptyPrefs,
		});
		expect(result).toBe("");
	});

	it("returns markdown starting with '## Project Memory'", () => {
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			observations: [makeScoredObs()],
			preferences: emptyPrefs,
		});
		expect(result).toContain("## Project Memory");
	});

	it("includes project name and last session date in header", () => {
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			observations: [makeScoredObs()],
			preferences: emptyPrefs,
		});
		expect(result).toContain("my-project");
		expect(result).toContain("2026-01-01");
	});

	it("shows 'first session' when lastSessionDate is null", () => {
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: null,
			observations: [makeScoredObs()],
			preferences: emptyPrefs,
		});
		expect(result).toContain("first session");
	});

	it("groups observations by type (Key Decisions, Patterns, Recent Errors)", () => {
		const observations: ScoredObservation[] = [
			makeScoredObs({ id: 1, type: "decision", summary: "Decision A" }),
			makeScoredObs({ id: 2, type: "pattern", summary: "Pattern A" }),
			makeScoredObs({ id: 3, type: "error", summary: "Error A" }),
		];

		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			observations,
			preferences: emptyPrefs,
		});

		expect(result).toContain("### Key Decisions");
		expect(result).toContain("### Patterns");
		expect(result).toContain("### Recent Errors");
	});

	it("respects token budget: small budget only includes Layer 1", () => {
		const observations: ScoredObservation[] = Array.from({ length: 20 }, (_, i) =>
			makeScoredObs({
				id: i + 1,
				summary: `Decision ${i + 1} summary text that is reasonably long`,
			}),
		);

		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			observations,
			preferences: emptyPrefs,
			tokenBudget: 100,
		});

		// Should be within budget
		const charBudget = 100 * CHARS_PER_TOKEN;
		expect(result.length).toBeLessThanOrEqual(charBudget);
	});

	it("never exceeds char budget (tokenBudget * CHARS_PER_TOKEN)", () => {
		const observations: ScoredObservation[] = Array.from({ length: 50 }, (_, i) =>
			makeScoredObs({
				id: i + 1,
				type: i % 3 === 0 ? "decision" : i % 3 === 1 ? "pattern" : "error",
				summary: `Observation ${i + 1}: ${"x".repeat(100)}`,
				content: `Full content for observation ${i + 1}: ${"y".repeat(500)}`,
			}),
		);

		const budget = 500;
		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			observations,
			preferences: emptyPrefs,
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
				sourceSession: null,
				createdAt: new Date().toISOString(),
				lastUpdated: new Date().toISOString(),
			},
		];

		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			observations: [makeScoredObs()],
			preferences: prefs,
		});

		expect(result).toContain("### Preferences");
		expect(result).toContain("preferred_language");
		expect(result).toContain("TypeScript");
	});

	it("sorts observations by relevance score (highest first in each group)", () => {
		const observations: ScoredObservation[] = [
			makeScoredObs({ id: 1, type: "decision", summary: "Low priority", relevanceScore: 0.5 }),
			makeScoredObs({ id: 2, type: "decision", summary: "High priority", relevanceScore: 2.0 }),
		];

		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			observations,
			preferences: emptyPrefs,
		});

		const highIdx = result.indexOf("High priority");
		const lowIdx = result.indexOf("Low priority");
		expect(highIdx).toBeLessThan(lowIdx);
	});

	it("with budget=2000 includes Layer 1 + Layer 2 (timeline)", () => {
		const observations: ScoredObservation[] = [makeScoredObs({ id: 1, summary: "A decision" })];

		const result = buildMemoryContext({
			projectName: "my-project",
			lastSessionDate: "2026-01-01",
			observations,
			preferences: emptyPrefs,
			tokenBudget: 2000,
		});

		expect(result).toContain("### Key Decisions");
		// With budget of 2000 tokens (8000 chars), there's room for timeline
		expect(result).toContain("Recent Activity");
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

		const testPath = "/tmp/test-project-access-count";
		const projectId = "proj-access-test";
		const now = new Date().toISOString();

		upsertProject({ id: projectId, path: testPath, name: "access-test", lastUpdated: now }, db);

		insertObservation(
			{
				projectId,
				sessionId: "sess-1",
				type: "decision",
				content: "Use repository pattern",
				summary: "Repository pattern adopted",
				confidence: 0.8,
				accessCount: 0,
				createdAt: now,
				lastAccessed: now,
			},
			db,
		);

		// Retrieve context — this should increment access_count
		const ctx = retrieveMemoryContext(testPath, 2000, db);
		expect(ctx).toContain("Repository pattern adopted");

		// Verify access_count was incremented
		const row = db
			.query("SELECT access_count FROM observations WHERE project_id = ?")
			.get(projectId) as { access_count: number };
		expect(row.access_count).toBeGreaterThanOrEqual(1);
	});
});
