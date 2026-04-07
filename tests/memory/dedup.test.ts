import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import {
	computeBigramOverlap,
	findDuplicateCandidate,
	mergeIntoExisting,
	normalizeContent,
} from "../../src/memory/dedup";
import { upsertProject } from "../../src/memory/repository";
import type { Memory } from "../../src/memory/types";

type StoredMemory = Memory & { id: number };

describe("dedup", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	function insertMemory(overrides: Partial<Memory> = {}): StoredMemory {
		const now = "2026-01-01T00:00:00Z";
		const memory: Memory = {
			textId: overrides.textId ?? `mem-${Math.random().toString(36).slice(2)}`,
			projectId: overrides.projectId ?? null,
			kind: overrides.kind ?? "workflow_rule",
			scope: overrides.scope ?? (overrides.projectId ? "project" : "user"),
			content: overrides.content ?? "Use bun test for this project before each commit",
			summary: overrides.summary ?? "Run bun test before commits",
			reasoning: overrides.reasoning ?? null,
			confidence: overrides.confidence ?? 0.7,
			evidenceCount: overrides.evidenceCount ?? 1,
			tags: overrides.tags ?? ["testing"],
			sourceSession: overrides.sourceSession ?? "sess-1",
			status: overrides.status ?? "active",
			supersedesMemoryId: overrides.supersedesMemoryId ?? null,
			accessCount: overrides.accessCount ?? 0,
			createdAt: overrides.createdAt ?? now,
			lastUpdated: overrides.lastUpdated ?? now,
			lastAccessed: overrides.lastAccessed ?? now,
		};

		const insertedRow = db
			.query(
				`INSERT INTO memories (
					text_id,
					project_id,
					kind,
					scope,
					content,
					summary,
					reasoning,
					confidence,
					evidence_count,
					tags,
					source_session,
					status,
					supersedes_memory_id,
					access_count,
					created_at,
					last_updated,
					last_accessed
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				RETURNING id`,
			)
			.get(
				memory.textId,
				memory.projectId,
				memory.kind,
				memory.scope,
				memory.content,
				memory.summary,
				memory.reasoning,
				memory.confidence,
				memory.evidenceCount,
				JSON.stringify(memory.tags),
				memory.sourceSession,
				memory.status,
				memory.supersedesMemoryId,
				memory.accessCount,
				memory.createdAt,
				memory.lastUpdated,
				memory.lastAccessed,
			) as { id: number } | null;

		if (!insertedRow) {
			throw new Error("Failed to insert test memory");
		}

		return { ...memory, id: insertedRow.id };
	}

	describe("normalizeContent", () => {
		test("lowercases and collapses whitespace", () => {
			expect(normalizeContent("  Use   Bun\nTEST\tNow  ")).toBe("use bun test now");
		});

		test("removes punctuation that does not affect meaning", () => {
			expect(normalizeContent("Hello, world! Use: bun-test?")).toBe("hello world use bun test");
		});

		test("returns empty string for punctuation-only or empty input", () => {
			expect(normalizeContent("")).toBe("");
			expect(normalizeContent("... !!!")).toBe("");
		});
	});

	describe("computeBigramOverlap", () => {
		test("returns 1 for identical multi-word texts", () => {
			expect(computeBigramOverlap("Use bun test before commit", "Use bun test before commit")).toBe(
				1,
			);
		});

		test("returns 0 for completely different texts", () => {
			expect(computeBigramOverlap("Use bun test before commit", "Ship docs after review")).toBe(0);
		});

		test("returns partial overlap for similar texts", () => {
			expect(
				computeBigramOverlap(
					"Use bun test for this project before each commit",
					"Use bun test for this project before every commit",
				),
			).toBe(0.6);
		});

		test("returns 0 for single-word texts", () => {
			expect(computeBigramOverlap("bun", "bun")).toBe(0);
		});

		test("returns 0 for empty strings", () => {
			expect(computeBigramOverlap("", "")).toBe(0);
		});
	});

	describe("findDuplicateCandidate", () => {
		test("finds the first active duplicate above the threshold", () => {
			const memory = insertMemory({
				content: "Use bun test for this project before each commit",
				lastUpdated: "2026-01-02T00:00:00Z",
			});

			const candidate = findDuplicateCandidate(
				"Use bun test for this project before every commit",
				null,
				undefined,
				db,
			);

			expect(candidate?.id).toBe(memory.id);
		});

		test("returns null when overlap is below the threshold", () => {
			insertMemory({ content: "Use bun test for this project before each commit" });

			expect(
				findDuplicateCandidate("Deploy the release after manual QA", null, undefined, db),
			).toBeNull();
		});

		test("respects project scope", () => {
			upsertProject(
				{
					id: "proj-1",
					path: "/tmp/project-one",
					name: "project-one",
					lastUpdated: "2026-01-01T00:00:00Z",
				},
				db,
			);

			const projectMemory = insertMemory({
				textId: "mem-project",
				projectId: "proj-1",
				scope: "project",
				content: "Use bun test for this project before each commit",
			});
			insertMemory({
				textId: "mem-user",
				projectId: null,
				scope: "user",
				content: "Use bun test for this project before each commit",
			});

			const candidate = findDuplicateCandidate(
				"Use bun test for this project before every commit",
				"proj-1",
				undefined,
				db,
			);

			expect(candidate?.id).toBe(projectMemory.id);
			expect(candidate?.projectId).toBe("proj-1");
		});

		test("filters by kind when provided", () => {
			insertMemory({
				textId: "mem-decision",
				kind: "decision",
				content: "Use bun test for this project before each commit",
			});
			insertMemory({
				textId: "mem-workflow",
				kind: "workflow_rule",
				content: "Use bun test for this project before each commit",
			});

			const withKind = findDuplicateCandidate(
				"Use bun test for this project before every commit",
				null,
				"decision",
				db,
			);
			expect(withKind?.kind).toBe("decision");

			const withoutKind = findDuplicateCandidate(
				"Use bun test for this project before every commit",
				null,
				undefined,
				db,
			);
			expect(withoutKind).not.toBeNull();
		});

		test("returns null for an empty database", () => {
			expect(
				findDuplicateCandidate(
					"Use bun test for this project before each commit",
					null,
					undefined,
					db,
				),
			).toBeNull();
		});
	});

	describe("mergeIntoExisting", () => {
		test("raises confidence, updates content and timestamp, but does not bump evidence count", () => {
			const existing = insertMemory({
				confidence: 0.6,
				evidenceCount: 2,
				lastUpdated: "2026-01-01T00:00:00Z",
			});

			const merged = mergeIntoExisting(
				existing,
				"Use bun test for this project before each commit",
				0.9,
				db,
			);

			expect(merged.evidenceCount).toBe(2);
			expect(merged.confidence).toBe(0.9);
			expect(merged.lastUpdated).not.toBe("2026-01-01T00:00:00Z");

			const stored = db
				.query("SELECT confidence, evidence_count, last_updated FROM memories WHERE id = ?")
				.get(existing.id) as {
				confidence: number;
				evidence_count: number;
				last_updated: string;
			};

			expect(stored.confidence).toBe(0.9);
			expect(stored.evidence_count).toBe(2);
			expect(stored.last_updated).toBe(merged.lastUpdated);
		});

		test("keeps the more detailed existing content when the new content is equivalent", () => {
			const existing = insertMemory({
				content: "Always use bun test for this project before each commit",
			});

			const merged = mergeIntoExisting(
				existing,
				"Use bun test for this project before each commit",
				0.7,
				db,
			);

			expect(merged.content).toBe("Always use bun test for this project before each commit");
		});

		test("replaces content when the new content is substantially different", () => {
			const existing = insertMemory({
				content: "Use bun test before commits",
			});

			const merged = mergeIntoExisting(
				existing,
				"Run bun test before commits and before opening a pull request",
				0.8,
				db,
			);

			expect(merged.content).toBe("Run bun test before commits and before opening a pull request");
		});
	});
});
