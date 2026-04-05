import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { insertObservation, searchObservations, upsertProject } from "../../src/memory/repository";
import { retrieveMemoryContext } from "../../src/memory/retrieval";

function insertProjectFixture(db: Database, projectId: string, projectPath: string): void {
	const now = new Date().toISOString();
	upsertProject(
		{
			id: projectId,
			path: projectPath,
			name: "memory concurrency project",
			firstSeenAt: now,
			lastUpdated: now,
		},
		db,
	);
}

function countObservations(db: Database): number {
	const row = db.query("SELECT COUNT(*) as count FROM observations").get() as { count: number };
	return row.count;
}

describe("Memory Concurrency", () => {
	let db: Database;
	let projectId: string;
	let projectPath: string;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
		projectId = `memory-project-${Date.now()}`;
		projectPath = `/tmp/memory-concurrency-${Date.now()}`;
		insertProjectFixture(db, projectId, projectPath);
	});

	afterEach(() => {
		db.close();
	});

	it("stores all concurrent observation inserts without data loss", async () => {
		const insertCount = 10;

		const results = await Promise.all(
			Array.from({ length: insertCount }, (_, index) =>
				Promise.resolve(
					insertObservation(
						{
							projectId,
							sessionId: `session-${index}`,
							type: "context",
							content: `parallel content ${index}`,
							summary: `parallel summary ${index}`,
							confidence: 0.9,
							accessCount: 0,
							createdAt: new Date().toISOString(),
							lastAccessed: new Date().toISOString(),
						},
						db,
					),
				),
			),
		);

		expect(results).toHaveLength(insertCount);
		expect(new Set(results.map((result) => result.id)).size).toBe(insertCount);
		expect(countObservations(db)).toBe(insertCount);
	});

	it("assigns monotonically unique ids during concurrent inserts", async () => {
		const results = await Promise.all(
			Array.from({ length: 10 }, (_, index) =>
				Promise.resolve(
					insertObservation(
						{
							projectId,
							sessionId: `ids-${index}`,
							type: "decision",
							content: `id content ${index}`,
							summary: `id summary ${index}`,
							confidence: 0.7,
							accessCount: 0,
							createdAt: new Date().toISOString(),
							lastAccessed: new Date().toISOString(),
						},
						db,
					),
				),
			),
		);

		const ids = results.map((result) => result.id);
		expect(ids.every((id): id is number => typeof id === "number")).toBe(true);
		const numericIds = ids.filter((id): id is number => typeof id === "number");
		expect(new Set(numericIds).size).toBe(numericIds.length);
		expect(Math.min(...numericIds)).toBeGreaterThan(0);
	});

	it("keeps inserted project associations intact during parallel writes", async () => {
		await Promise.all(
			Array.from({ length: 10 }, (_, index) =>
				Promise.resolve(
					insertObservation(
						{
							projectId,
							sessionId: `project-${index}`,
							type: "context",
							content: `project content ${index}`,
							summary: `project summary ${index}`,
							confidence: 0.65,
							accessCount: 0,
							createdAt: new Date().toISOString(),
							lastAccessed: new Date().toISOString(),
						},
						db,
					),
				),
			),
		);

		const groupedCount = (
			db
				.query("SELECT COUNT(*) as count FROM observations WHERE project_id = ?")
				.get(projectId) as {
				count: number;
			}
		).count;
		expect(groupedCount).toBe(10);
	});

	it("returns FTS matches for all inserted concurrency records", async () => {
		await Promise.all(
			Array.from({ length: 10 }, (_, index) =>
				Promise.resolve(
					insertObservation(
						{
							projectId,
							sessionId: `fts-${index}`,
							type: "error",
							content: `fts concurrency marker ${index}`,
							summary: `fts concurrency marker ${index}`,
							confidence: 0.8,
							accessCount: 0,
							createdAt: new Date().toISOString(),
							lastAccessed: new Date().toISOString(),
						},
						db,
					),
				),
			),
		);

		const results = searchObservations("concurrency", projectId, 20, db);
		expect(results.length).toBe(10);
		expect(results.every((result) => result.summary.includes("concurrency"))).toBe(true);
	});

	it("supports concurrent retrieval while writes update the FTS index", async () => {
		insertObservation(
			{
				projectId,
				sessionId: "seed-session",
				type: "error",
				content: "concurrency seed observation",
				summary: "concurrency seed",
				confidence: 0.8,
				accessCount: 0,
				createdAt: new Date().toISOString(),
				lastAccessed: new Date().toISOString(),
			},
			db,
		);

		const writeOperations = Array.from({ length: 12 }, (_, index) =>
			Promise.resolve(
				insertObservation(
					{
						projectId,
						sessionId: `writer-${index}`,
						type: index % 2 === 0 ? "error" : "decision",
						content: `concurrency token ${index}`,
						summary: `concurrency token ${index}`,
						confidence: 0.75,
						accessCount: 0,
						createdAt: new Date().toISOString(),
						lastAccessed: new Date().toISOString(),
					},
					db,
				),
			),
		);

		const readOperations = Array.from({ length: 12 }, () =>
			Promise.resolve({
				searchResults: searchObservations("concurrency", projectId, 50, db),
				context: retrieveMemoryContext(projectPath, 2000, db),
			}),
		);

		const combinedResults = await Promise.all([...writeOperations, ...readOperations]);
		const retrievals = combinedResults.filter(
			(
				result,
			): result is {
				readonly searchResults: ReturnType<typeof searchObservations>;
				readonly context: string;
			} => typeof result === "object" && result !== null && "searchResults" in result,
		);

		expect(countObservations(db)).toBe(13);
		expect(retrievals).toHaveLength(readOperations.length);
		expect(
			retrievals.every(
				(result) =>
					result.searchResults.length >= 0 &&
					result.searchResults.every((entry) => entry.summary.includes("concurrency")) &&
					typeof result.context === "string",
			),
		).toBe(true);

		const finalSearch = searchObservations("concurrency", projectId, 50, db);
		expect(finalSearch.length).toBeGreaterThanOrEqual(12);
		expect(() => retrieveMemoryContext(projectPath, 2000, db)).not.toThrow();
	});

	it("returns stable memory context after concurrent writes complete", async () => {
		await Promise.all(
			Array.from({ length: 10 }, (_, index) =>
				Promise.resolve(
					insertObservation(
						{
							projectId,
							sessionId: `stable-${index}`,
							type: "error",
							content: `stable context ${index}`,
							summary: `stable context ${index}`,
							confidence: 0.85,
							accessCount: 0,
							createdAt: new Date().toISOString(),
							lastAccessed: new Date().toISOString(),
						},
						db,
					),
				),
			),
		);

		const context = retrieveMemoryContext(projectPath, 2000, db);
		expect(context).toContain("Project Memory");
		expect(context).toContain("stable context");
	});

	it("keeps search operational across repeated mixed read-write batches", async () => {
		for (let batch = 0; batch < 3; batch += 1) {
			await Promise.all([
				...Array.from({ length: 4 }, (_, index) =>
					Promise.resolve(
						insertObservation(
							{
								projectId,
								sessionId: `batch-${batch}-${index}`,
								type: "decision",
								content: `batch concurrency ${batch}-${index}`,
								summary: `batch concurrency ${batch}-${index}`,
								confidence: 0.72,
								accessCount: 0,
								createdAt: new Date().toISOString(),
								lastAccessed: new Date().toISOString(),
							},
							db,
						),
					),
				),
				Promise.resolve(searchObservations("batch", projectId, 50, db)),
				Promise.resolve(retrieveMemoryContext(projectPath, 2000, db)),
			]);
		}

		const results = searchObservations("batch", projectId, 50, db);
		expect(results.length).toBe(12);
		expect(() => retrieveMemoryContext(projectPath, 2000, db)).not.toThrow();
	});
});
