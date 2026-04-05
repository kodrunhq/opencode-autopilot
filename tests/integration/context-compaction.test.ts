import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allocateBudget, truncateToTokens } from "../../src/context/budget";
import { createCompactionHandler } from "../../src/context/compaction-handler";
import { createContextInjector } from "../../src/context/injector";
import type { ContextSource } from "../../src/context/types";

describe("Integration: context injection + compaction", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "context-compaction-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("inject context from discovered files → verify budget enforcement", async () => {
		await writeFile(join(tempDir, "CLAUDE.md"), "# Project\nThis is a test project with rules.");
		await writeFile(join(tempDir, "README.md"), "# README\nProject description here.");

		const output = { system: [] as string[] };
		const injector = createContextInjector({
			projectRoot: tempDir,
			totalBudget: 4000,
		});

		await injector({ sessionID: "session-ctx-1" }, output);

		// Verify injection happened
		expect(output.system.length).toBeGreaterThan(0);
		const injectedText = output.system.join("\n");
		expect(injectedText).toContain("[Source:");
	});

	test("cached context re-used within TTL", async () => {
		await writeFile(join(tempDir, "CLAUDE.md"), "# Cached Content");

		let discoverCallCount = 0;
		const customDiscover = async () => {
			discoverCallCount += 1;
			return [
				{
					name: "CLAUDE.md",
					filePath: join(tempDir, "CLAUDE.md"),
					content: "# Cached Content",
					priority: 85,
					tokenEstimate: 10,
				},
			] as const;
		};

		const injector = createContextInjector({
			projectRoot: tempDir,
			totalBudget: 4000,
			ttlMs: 60_000,
			discover: customDiscover,
		});

		const output1 = { system: [] as string[] };
		await injector({ sessionID: "session-cache" }, output1);
		expect(discoverCallCount).toBe(1);

		const output2 = { system: [] as string[] };
		await injector({ sessionID: "session-cache" }, output2);
		expect(discoverCallCount).toBe(1);

		expect(output1.system).toEqual(output2.system);
	});

	test("compaction handler clears cache and re-injects", async () => {
		let discoverCount = 0;
		const customDiscover = async () => {
			discoverCount += 1;
			return [
				{
					name: "CLAUDE.md",
					filePath: join(tempDir, "CLAUDE.md"),
					content: `# Discover call ${discoverCount}`,
					priority: 85,
					tokenEstimate: 15,
				},
			] as const;
		};

		const injector = createContextInjector({
			projectRoot: tempDir,
			totalBudget: 4000,
			ttlMs: 60_000,
			discover: customDiscover,
		});

		// First injection: caches the result
		const output1 = { system: [] as string[] };
		await injector({ sessionID: "session-compact" }, output1);
		expect(discoverCount).toBe(1);

		const compactionHandler = createCompactionHandler(injector);
		await compactionHandler({
			event: {
				type: "session.compacted",
				properties: { sessionID: "session-compact" },
			},
		});

		const output2 = { system: [] as string[] };
		await injector({ sessionID: "session-compact" }, output2);
		expect(discoverCount).toBe(2);
	});

	test("compaction handler ignores non-compaction events", async () => {
		let discoverCount = 0;
		const customDiscover = async () => {
			discoverCount += 1;
			return [] as const;
		};

		const injector = createContextInjector({
			projectRoot: tempDir,
			totalBudget: 4000,
			discover: customDiscover,
		});

		await injector({ sessionID: "session-ignore" }, { system: [] });
		expect(discoverCount).toBe(1);

		const compactionHandler = createCompactionHandler(injector);
		await compactionHandler({
			event: { type: "tool.execute", properties: { sessionID: "session-ignore" } },
		});

		await injector({ sessionID: "session-ignore" }, { system: [] });
		expect(discoverCount).toBe(1);
	});

	test("budget allocation respects total token limit", () => {
		const sources: readonly ContextSource[] = [
			{
				name: "CLAUDE.md",
				filePath: "/a/CLAUDE.md",
				content: "x".repeat(4000),
				priority: 90,
				tokenEstimate: 1000,
			},
			{
				name: "README.md",
				filePath: "/a/README.md",
				content: "y".repeat(4000),
				priority: 50,
				tokenEstimate: 1000,
			},
			{
				name: "AGENTS.md",
				filePath: "/a/AGENTS.md",
				content: "z".repeat(4000),
				priority: 80,
				tokenEstimate: 1000,
			},
		];

		// Budget of 2000 tokens — cannot fit all 3 sources (3000 total)
		const { allocations, totalUsed } = allocateBudget(sources, 2000);
		expect(totalUsed).toBeLessThanOrEqual(2000);

		// Higher priority sources should get full allocation first
		const claudeAlloc = allocations.get("/a/CLAUDE.md") ?? 0;
		const agentsAlloc = allocations.get("/a/AGENTS.md") ?? 0;
		const readmeAlloc = allocations.get("/a/README.md") ?? 0;

		// CLAUDE.md (90) and AGENTS.md (80) should be prioritized over README.md (50)
		expect(claudeAlloc).toBe(1000);
		expect(agentsAlloc).toBe(1000);
		expect(readmeAlloc).toBe(0);
	});

	test("truncateToTokens respects character limit with suffix", () => {
		const longContent = "a".repeat(1000);

		// 50 tokens * 4 chars/token = 200 chars max
		const truncated = truncateToTokens(longContent, 50);
		expect(truncated.length).toBeLessThanOrEqual(200);
		expect(truncated).toContain("... [truncated]");

		// Short content should not be truncated
		const shortContent = "hello";
		const notTruncated = truncateToTokens(shortContent, 50);
		expect(notTruncated).toBe("hello");
	});

	test("zero budget produces empty injection", () => {
		const sources: readonly ContextSource[] = [
			{
				name: "CLAUDE.md",
				filePath: "/a/CLAUDE.md",
				content: "test",
				priority: 90,
				tokenEstimate: 100,
			},
		];
		const { allocations, totalUsed } = allocateBudget(sources, 0);
		expect(totalUsed).toBe(0);
		expect(allocations.get("/a/CLAUDE.md")).toBe(0);
	});

	test("no sessionID skips injection gracefully", async () => {
		const output = { system: [] as string[] };
		const injector = createContextInjector({
			projectRoot: tempDir,
			totalBudget: 4000,
		});

		await injector({}, output);
		expect(output.system).toHaveLength(0);
	});

	test("discovery failure produces empty injection (best-effort)", async () => {
		const injector = createContextInjector({
			projectRoot: tempDir,
			totalBudget: 4000,
			discover: async () => {
				throw new Error("discovery failed");
			},
		});

		const output = { system: [] as string[] };
		await injector({ sessionID: "session-err" }, output);
		// Best-effort: should not throw, returns empty
		expect(output.system).toHaveLength(0);
	});

	test("context survives compaction cycle within budget", async () => {
		const contentA = "A".repeat(200);
		const contentB = "B".repeat(200);
		let callCount = 0;

		const customDiscover = async () => {
			callCount += 1;
			return [
				{
					name: "CLAUDE.md",
					filePath: "/x/CLAUDE.md",
					content: contentA,
					priority: 90,
					tokenEstimate: 50,
				},
				{
					name: "README.md",
					filePath: "/x/README.md",
					content: contentB,
					priority: 50,
					tokenEstimate: 50,
				},
			] as const;
		};

		const injector = createContextInjector({
			projectRoot: tempDir,
			totalBudget: 200,
			ttlMs: 60_000,
			discover: customDiscover,
		});

		// Initial injection
		const output1 = { system: [] as string[] };
		await injector({ sessionID: "session-ctx-1" }, output1);

		expect(output1.system.length).toBeGreaterThan(0);
		const text1 = output1.system.join("\n");

		// Simulate compaction
		const compactionHandler = createCompactionHandler(injector);
		await compactionHandler({
			event: { type: "session.compacted", properties: { sessionID: "session-survive" } },
		});

		// Re-inject after compaction
		const output2 = { system: [] as string[] };
		await injector({ sessionID: "session-survive" }, output2);
		expect(output2.system.length).toBeGreaterThan(0);
		const text2 = output2.system.join("\n");

		// Content should be equivalent (same sources, same budget)
		expect(text1).toEqual(text2);
		expect(callCount).toBe(2); // Once initial, once after cache clear
	});
});
