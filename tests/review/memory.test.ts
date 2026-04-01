import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReviewMemory } from "../../src/review/memory";
import {
	createEmptyMemory,
	loadReviewMemory,
	pruneMemory,
	saveReviewMemory,
} from "../../src/review/memory";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "review-memory-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("createEmptyMemory", () => {
	test("returns valid empty memory object", () => {
		const memory = createEmptyMemory();
		expect(memory.schemaVersion).toBe(1);
		expect(memory.projectProfile.stacks).toEqual([]);
		expect(memory.projectProfile.lastDetectedAt).toBe("");
		expect(memory.recentFindings).toEqual([]);
		expect(memory.falsePositives).toEqual([]);
		expect(memory.lastReviewedAt).toBeNull();
	});
});

describe("loadReviewMemory", () => {
	test("returns null when file does not exist", async () => {
		const result = await loadReviewMemory(tempDir);
		expect(result).toBeNull();
	});

	test("returns parsed memory when file exists and is valid", async () => {
		const memoryDir = join(tempDir, ".opencode-autopilot");
		const { mkdir } = await import("node:fs/promises");
		await mkdir(memoryDir, { recursive: true });
		const memory = createEmptyMemory();
		await writeFile(
			join(memoryDir, "review-memory.json"),
			JSON.stringify(memory, null, 2),
			"utf-8",
		);

		const result = await loadReviewMemory(tempDir);
		expect(result).not.toBeNull();
		expect(result!.schemaVersion).toBe(1);
	});

	test("returns null on invalid JSON content (recoverable)", async () => {
		const memoryDir = join(tempDir, ".opencode-autopilot");
		const { mkdir } = await import("node:fs/promises");
		await mkdir(memoryDir, { recursive: true });
		await writeFile(join(memoryDir, "review-memory.json"), "not valid json {{{", "utf-8");

		const result = await loadReviewMemory(tempDir);
		expect(result).toBeNull();
	});

	test("returns null on valid JSON but invalid schema (recoverable)", async () => {
		const memoryDir = join(tempDir, ".opencode-autopilot");
		const { mkdir } = await import("node:fs/promises");
		await mkdir(memoryDir, { recursive: true });
		await writeFile(
			join(memoryDir, "review-memory.json"),
			JSON.stringify({ bad: "data" }),
			"utf-8",
		);

		const result = await loadReviewMemory(tempDir);
		expect(result).toBeNull();
	});
});

describe("saveReviewMemory", () => {
	test("writes to .opencode-autopilot/review-memory.json with atomic write", async () => {
		const memory = createEmptyMemory();
		await saveReviewMemory(memory, tempDir);

		const filePath = join(tempDir, ".opencode-autopilot", "review-memory.json");
		const raw = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(raw);
		expect(parsed.schemaVersion).toBe(1);
	});

	test("creates .opencode-autopilot directory if it does not exist", async () => {
		const memory = createEmptyMemory();
		await saveReviewMemory(memory, tempDir);

		const filePath = join(tempDir, ".opencode-autopilot", "review-memory.json");
		const raw = await readFile(filePath, "utf-8");
		expect(JSON.parse(raw).schemaVersion).toBe(1);
	});

	test("validates memory before writing", async () => {
		const badMemory = { schemaVersion: 99, bad: true } as unknown as ReviewMemory;
		await expect(saveReviewMemory(badMemory, tempDir)).rejects.toThrow();
	});
});

describe("pruneMemory", () => {
	test("caps recentFindings at 100 (keeps newest)", () => {
		const findings = Array.from({ length: 120 }, (_, i) => ({
			severity: "CRITICAL" as const,
			domain: "test",
			title: `Finding ${i}`,
			file: "test.ts",
			agent: "test-agent",
			source: "phase1" as const,
			evidence: "evidence",
			problem: "problem",
			fix: "fix it",
		}));

		const memory: ReviewMemory = {
			...createEmptyMemory(),
			recentFindings: findings,
		};

		const pruned = pruneMemory(memory);
		expect(pruned.recentFindings.length).toBe(100);
		// Keeps the last 100 (newest -- later entries are newer)
		expect(pruned.recentFindings[0].title).toBe("Finding 20");
		expect(pruned.recentFindings[99].title).toBe("Finding 119");
	});

	test("caps falsePositives at 50 (keeps newest by markedAt)", () => {
		const falsePositives = Array.from({ length: 60 }, (_, i) => ({
			finding: {
				severity: "CRITICAL" as const,
				domain: "test",
				title: `FP ${i}`,
				file: "test.ts",
				agent: "test-agent",
				source: "phase1" as const,
				evidence: "evidence",
				problem: "problem",
				fix: "fix it",
			},
			reason: "not relevant",
			markedAt: new Date(Date.now() - (60 - i) * 1000).toISOString(),
		}));

		const memory: ReviewMemory = {
			...createEmptyMemory(),
			falsePositives,
		};

		const pruned = pruneMemory(memory);
		expect(pruned.falsePositives.length).toBe(50);
	});

	test("removes falsePositives older than 30 days", () => {
		const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
		const recentDate = new Date().toISOString();

		const memory: ReviewMemory = {
			...createEmptyMemory(),
			falsePositives: [
				{
					finding: {
						severity: "CRITICAL" as const,
						domain: "test",
						title: "old FP",
						file: "test.ts",
						agent: "test-agent",
						source: "phase1" as const,
						evidence: "evidence",
						problem: "problem",
						fix: "fix it",
					},
					reason: "not relevant",
					markedAt: oldDate,
				},
				{
					finding: {
						severity: "CRITICAL" as const,
						domain: "test",
						title: "recent FP",
						file: "test.ts",
						agent: "test-agent",
						source: "phase1" as const,
						evidence: "evidence",
						problem: "problem",
						fix: "fix it",
					},
					reason: "not relevant",
					markedAt: recentDate,
				},
			],
		};

		const pruned = pruneMemory(memory);
		expect(pruned.falsePositives.length).toBe(1);
		expect(pruned.falsePositives[0].finding.title).toBe("recent FP");
	});

	test("returns new object (no mutation)", () => {
		const memory = createEmptyMemory();
		const pruned = pruneMemory(memory);
		expect(pruned).not.toBe(memory);
	});
});
