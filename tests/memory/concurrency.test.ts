import { describe, expect, it } from "bun:test";
import { getMemoryDb } from "../../src/memory/database";
import { insertObservation } from "../../src/memory/observations";
import { upsertPreference } from "../../src/memory/preferences";
import { retrieveMemoryContext } from "../../src/memory/retrieval";

describe("Memory Concurrency", () => {
	it("should handle 10 parallel inserts without collision", async () => {
		const db = getMemoryDb();
		const randomProjectId = `test-project-${Date.now()}-${Math.random()}`;

		const inserts = Array.from({ length: 10 }).map((_, i) => {
			return new Promise<number>((resolve) => {
				setTimeout(() => {
					const obs = insertObservation(
						{
							projectId: null,
							sessionId: `session-${i}`,
							type: "context",
							content: `content-${i}`,
							summary: `summary-${i}`,
							confidence: 0.9,
							accessCount: 0,
							createdAt: new Date().toISOString(),
							lastAccessed: new Date().toISOString(),
						},
						db,
					);
					resolve(obs.id as number);
				}, Math.random() * 10);
			});
		});

		const ids = await Promise.all(inserts);
		const uniqueIds = new Set(ids);

		expect(uniqueIds.size).toBe(10);
		expect(ids.every((id) => typeof id === "number" && id > 0)).toBe(true);
	});

	it("should handle mixed concurrent reads and writes gracefully", async () => {
		const db = getMemoryDb();
		const projectId = `mixed-proj-${Date.now()}`;
		const sessionId = "mixed-session";

		insertObservation(
			{
				projectId: null,
				sessionId,
				type: "context",
				content: "Initial setup",
				summary: "setup",
				confidence: 0.9,
				accessCount: 0,
				createdAt: new Date().toISOString(),
				lastAccessed: new Date().toISOString(),
			},
			db,
		);

		upsertPreference(
			{
				id: "pref-setup",
				key: "test-key",
				value: "test-val",
				confidence: 0.9,
				sourceSession: sessionId,
				createdAt: new Date().toISOString(),
				lastUpdated: new Date().toISOString(),
			},
			db,
		);

		const operations = Array.from({ length: 50 }).map((_, i) => {
			return new Promise<boolean>((resolve) => {
				setTimeout(async () => {
					try {
						if (i % 3 === 0) {
							insertObservation(
								{
									projectId: null,
									sessionId,
									type: "decision",
									content: `Concurrent decision ${i}`,
									summary: `Decision ${i}`,
									confidence: 0.8,
									accessCount: 0,
									createdAt: new Date().toISOString(),
									lastAccessed: new Date().toISOString(),
								},
								db,
							);
						} else if (i % 3 === 1) {
							upsertPreference(
								{
									id: `pref-${i}`,
									key: `key-${i}`,
									value: `val-${i}`,
									confidence: 0.8,
									sourceSession: sessionId,
									createdAt: new Date().toISOString(),
									lastUpdated: new Date().toISOString(),
								},
								db,
							);
						} else {
							retrieveMemoryContext(projectId, undefined, db);
						}
						resolve(true);
					} catch (e) {
						console.error(e);
						resolve(false);
					}
				}, Math.random() * 20);
			});
		});

		const results = await Promise.all(operations);
		expect(results.every((r) => r === true)).toBe(true);
	});
});
