import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { initMemoryDb } from "../../src/memory/database";
import { createMemoryInjector, invalidateMemoryCache } from "../../src/memory/injector";
import { saveMemory } from "../../src/memory/memories";
import { computeProjectKey } from "../../src/memory/project-key";
import {
	insertObservation,
	upsertPreferenceRecord,
	upsertProject,
} from "../../src/memory/repository";

const PROJECT_PATH = "/tmp/test-project";
const PROJECT_KEY = computeProjectKey(PROJECT_PATH);

describe("createMemoryInjector", () => {
	let db: Database;

	beforeEach(() => {
		db = new Database(":memory:");
		initMemoryDb(db);
	});

	afterEach(() => {
		db.close();
	});

	test("returns a function", () => {
		const injector = createMemoryInjector({
			projectRoot: PROJECT_PATH,
			tokenBudget: 2000,
			halfLifeDays: 90,
			getDb: () => db,
		});
		expect(typeof injector).toBe("function");
	});

	test("skips injection when no sessionID is provided", async () => {
		const injector = createMemoryInjector({
			projectRoot: PROJECT_PATH,
			tokenBudget: 2000,
			halfLifeDays: 90,
			getDb: () => db,
		});
		const output = { system: ["existing"] };
		await injector({ model: { providerID: "anthropic", modelID: "claude-3" } }, output);
		expect(output.system).toEqual(["existing"]);
	});

	test("injects memory instructions block even when no memories exist (V2 bootstrap)", async () => {
		const injector = createMemoryInjector({
			projectRoot: PROJECT_PATH,
			tokenBudget: 2000,
			halfLifeDays: 90,
			getDb: () => db,
		});
		const output = { system: ["existing"] };
		await injector(
			{ sessionID: "sess-1", model: { providerID: "anthropic", modelID: "claude-3" } },
			output,
		);
		expect(output.system.length).toBe(2);
		expect(output.system[1]).toContain("Memory Instructions");
		expect(output.system[1]).toContain("oc_memory_save");
	});

	test("pushes V2 memory context with instructions when V2 memories exist", async () => {
		const now = new Date().toISOString();
		upsertProject(
			{ id: PROJECT_KEY, path: PROJECT_PATH, name: "test-project", lastUpdated: now },
			db,
		);

		saveMemory(
			{
				kind: "preference",
				content: "editor: vim",
				summary: "Use vim editor",
				projectId: PROJECT_KEY,
				scope: "project",
			},
			db,
		);

		const injector = createMemoryInjector({
			projectRoot: PROJECT_PATH,
			tokenBudget: 2000,
			halfLifeDays: 90,
			getDb: () => db,
		});
		const output = { system: ["existing"] };
		await injector(
			{ sessionID: "sess-1", model: { providerID: "anthropic", modelID: "claude-3" } },
			output,
		);
		expect(output.system.length).toBe(2);
		expect(output.system[1]).toContain("Memory (auto-injected)");
		expect(output.system[1]).toContain("vim");
		expect(output.system[1]).toContain("Memory Instructions");
	});

	test("caches context per sessionID (does not rebuild)", async () => {
		const now = new Date().toISOString();
		upsertProject(
			{ id: PROJECT_KEY, path: PROJECT_PATH, name: "test-project", lastUpdated: now },
			db,
		);
		upsertPreferenceRecord(
			{
				key: "editor",
				value: "vim",
				scope: "project",
				projectId: PROJECT_KEY,
				createdAt: now,
				lastUpdated: now,
			},
			db,
		);
		insertObservation(
			{
				projectId: PROJECT_KEY,
				sessionId: "sess-0",
				type: "error",
				content: "Avoid nested transactions during project resolution",
				summary: "Nested transaction failure",
				confidence: 0.9,
				accessCount: 1,
				createdAt: now,
				lastAccessed: now,
			},
			db,
		);

		const injector = createMemoryInjector({
			projectRoot: PROJECT_PATH,
			tokenBudget: 2000,
			halfLifeDays: 90,
			getDb: () => db,
		});

		// First call
		const output1 = { system: [] as string[] };
		await injector(
			{ sessionID: "sess-1", model: { providerID: "anthropic", modelID: "claude-3" } },
			output1,
		);
		const firstResult = output1.system[0];

		// Second call with same sessionID
		const output2 = { system: [] as string[] };
		await injector(
			{ sessionID: "sess-1", model: { providerID: "anthropic", modelID: "claude-3" } },
			output2,
		);
		expect(output2.system[0]).toBe(firstResult);
	});

	test("different sessionIDs get independent cache entries", async () => {
		const now = new Date().toISOString();
		upsertProject(
			{ id: PROJECT_KEY, path: PROJECT_PATH, name: "test-project", lastUpdated: now },
			db,
		);
		upsertPreferenceRecord(
			{
				key: "editor",
				value: "vim",
				scope: "project",
				projectId: PROJECT_KEY,
				createdAt: now,
				lastUpdated: now,
			},
			db,
		);
		insertObservation(
			{
				projectId: PROJECT_KEY,
				sessionId: "sess-0",
				type: "error",
				content: "Avoid nested transactions during project resolution",
				summary: "Nested transaction failure",
				confidence: 0.9,
				accessCount: 1,
				createdAt: now,
				lastAccessed: now,
			},
			db,
		);

		const injector = createMemoryInjector({
			projectRoot: PROJECT_PATH,
			tokenBudget: 2000,
			halfLifeDays: 90,
			getDb: () => db,
		});

		const output1 = { system: [] as string[] };
		await injector(
			{ sessionID: "sess-a", model: { providerID: "anthropic", modelID: "claude-3" } },
			output1,
		);
		expect(output1.system.length).toBe(1);

		const output2 = { system: [] as string[] };
		await injector(
			{ sessionID: "sess-b", model: { providerID: "anthropic", modelID: "claude-3" } },
			output2,
		);
		expect(output2.system.length).toBe(1);
	});

	test("catches errors silently (best-effort)", async () => {
		const injector = createMemoryInjector({
			projectRoot: PROJECT_PATH,
			tokenBudget: 2000,
			halfLifeDays: 90,
			getDb: () => {
				throw new Error("DB unavailable");
			},
		});
		const output = { system: ["existing"] };
		// Should not throw
		await injector(
			{ sessionID: "sess-1", model: { providerID: "anthropic", modelID: "claude-3" } },
			output,
		);
		expect(output.system).toEqual(["existing"]);
	});

	test("invalidateMemoryCache clears cached entries", async () => {
		const now = new Date().toISOString();
		upsertProject(
			{ id: PROJECT_KEY, path: PROJECT_PATH, name: "test-project", lastUpdated: now },
			db,
		);
		insertObservation(
			{
				projectId: PROJECT_KEY,
				sessionId: "sess-0",
				type: "error",
				content: "Some error observation",
				summary: "Error obs",
				confidence: 0.9,
				accessCount: 1,
				createdAt: now,
				lastAccessed: now,
			},
			db,
		);

		const injector = createMemoryInjector({
			projectRoot: PROJECT_PATH,
			tokenBudget: 2000,
			halfLifeDays: 90,
			getDb: () => db,
		});

		const output1 = { system: [] as string[] };
		await injector(
			{ sessionID: "sess-1", model: { providerID: "anthropic", modelID: "claude-3" } },
			output1,
		);
		expect(output1.system.length).toBe(1);

		invalidateMemoryCache(injector);

		const output2 = { system: [] as string[] };
		await injector(
			{ sessionID: "sess-1", model: { providerID: "anthropic", modelID: "claude-3" } },
			output2,
		);
		expect(output2.system.length).toBe(1);
	});

	test("uses V2 retrieval when memories exist in memories table", async () => {
		const now = new Date().toISOString();
		upsertProject(
			{ id: PROJECT_KEY, path: PROJECT_PATH, name: "test-project", lastUpdated: now },
			db,
		);

		saveMemory(
			{
				kind: "preference",
				content: "Always use strict TypeScript mode",
				summary: "Strict TS mode",
				projectId: PROJECT_KEY,
				scope: "project",
			},
			db,
		);

		const injector = createMemoryInjector({
			projectRoot: PROJECT_PATH,
			tokenBudget: 2000,
			halfLifeDays: 90,
			getDb: () => db,
		});

		const output = { system: [] as string[] };
		await injector(
			{ sessionID: "sess-v2", model: { providerID: "anthropic", modelID: "claude-3" } },
			output,
		);

		expect(output.system.length).toBe(1);
		expect(output.system[0]).toContain("Memory (auto-injected)");
		expect(output.system[0]).toContain("Strict TS mode");
		expect(output.system[0]).toContain("Memory Instructions");
	});
});
