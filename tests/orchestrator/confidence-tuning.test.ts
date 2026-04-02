import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { insertObservation, upsertProject } from "../../src/memory/repository";
import { getMemoryTunedDepth } from "../../src/orchestrator/arena";
import type { ConfidenceEntry } from "../../src/orchestrator/types";

function makeEntry(overrides: Partial<ConfidenceEntry> = {}): ConfidenceEntry {
	return {
		timestamp: "2026-03-31T00:00:00Z",
		phase: "RECON",
		agent: "researcher",
		area: "tech-stack",
		level: "HIGH",
		rationale: "test",
		...overrides,
	};
}

const TEST_PROJECT_PATH = "/tmp/test-project-confidence-tuning";
const TEST_PROJECT = {
	id: "proj-tuning-1",
	path: TEST_PROJECT_PATH,
	name: "test-project",
	lastUpdated: "2026-01-01T00:00:00Z",
};

function makeObservation(type: string, index: number) {
	return {
		projectId: TEST_PROJECT.id,
		sessionId: "sess-1",
		type: type as "error" | "decision" | "pattern" | "context",
		content: `${type} observation ${index}`,
		summary: `${type} ${index}`,
		confidence: 0.8,
		accessCount: 1,
		createdAt: "2026-01-01T00:00:00Z",
		lastAccessed: "2026-01-01T00:00:00Z",
	};
}

describe("getMemoryTunedDepth", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("returns standard getDebateDepth when no memory observations exist", () => {
		const entries = [makeEntry({ level: "HIGH" }), makeEntry({ level: "HIGH" })];
		const result = getMemoryTunedDepth(entries, "/tmp/nonexistent-project-xyz", db);
		// No project in DB -> should return standard depth (1 for dominant HIGH)
		expect(result).toBe(1);
	});

	test("increases depth by 1 (capped at 3) when memory contains 3+ error-type observations", () => {
		upsertProject(TEST_PROJECT, db);
		// Insert 3 error observations
		for (let i = 0; i < 3; i++) {
			insertObservation(makeObservation("error", i), db);
		}

		// HIGH dominant -> base depth 1, +1 for errors = 2
		const highEntries = [makeEntry({ level: "HIGH" }), makeEntry({ level: "HIGH" })];
		expect(getMemoryTunedDepth(highEntries, TEST_PROJECT_PATH, db)).toBe(2);

		// MEDIUM dominant -> base depth 2, +1 for errors = 3
		const medEntries = [makeEntry({ level: "MEDIUM" }), makeEntry({ level: "MEDIUM" })];
		expect(getMemoryTunedDepth(medEntries, TEST_PROJECT_PATH, db)).toBe(3);
	});

	test("returns standard depth when memory has only pattern/decision observations (no error signal)", () => {
		upsertProject(TEST_PROJECT, db);
		insertObservation(makeObservation("pattern", 0), db);
		insertObservation(makeObservation("decision", 1), db);
		insertObservation(makeObservation("pattern", 2), db);

		const entries = [makeEntry({ level: "HIGH" }), makeEntry({ level: "HIGH" })];
		// No error observations -> standard depth (1 for dominant HIGH)
		expect(getMemoryTunedDepth(entries, TEST_PROJECT_PATH, db)).toBe(1);
	});

	test("never exceeds 3", () => {
		upsertProject(TEST_PROJECT, db);
		// Insert 10 error observations
		for (let i = 0; i < 10; i++) {
			insertObservation(makeObservation("error", i), db);
		}

		// LOW dominant -> base depth 3, +1 would be 4, but capped at 3
		const lowEntries = [makeEntry({ level: "LOW" }), makeEntry({ level: "LOW" })];
		expect(getMemoryTunedDepth(lowEntries, TEST_PROJECT_PATH, db)).toBe(3);
	});

	test("is best-effort -- returns standard depth on any memory retrieval error", () => {
		// Close the DB to simulate an error condition
		const closedDb = new Database(":memory:");
		closedDb.close();

		const entries = [makeEntry({ level: "HIGH" }), makeEntry({ level: "HIGH" })];
		// Should not throw, should return standard depth
		const result = getMemoryTunedDepth(entries, TEST_PROJECT_PATH, closedDb);
		expect(result).toBe(1);
	});
});
