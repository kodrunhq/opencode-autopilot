import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	appendForensicEvent,
	getDedupCacheSize,
	isDuplicateEvent,
	resetDedupCache,
} from "../../src/observability/forensic-log";

describe("forensic event deduplication", () => {
	let projectRoot: string;
	let artifactDir: string;
	let originalNow: () => number;

	beforeEach(async () => {
		resetDedupCache();
		originalNow = Date.now;
		projectRoot = join(
			tmpdir(),
			`forensic-dedup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		artifactDir = join(projectRoot, ".opencode-autopilot");
		await mkdir(artifactDir, { recursive: true });
	});

	afterEach(async () => {
		Date.now = originalNow;
		resetDedupCache();
		await rm(projectRoot, { recursive: true, force: true });
	});

	test("deduplicates same event within 1s", async () => {
		const event = {
			projectRoot,
			domain: "session" as const,
			type: "fallback" as const,
			phase: "BUILD",
			agent: "oc-implementer",
			sessionId: "session-1",
		};

		appendForensicEvent(projectRoot, event);
		appendForensicEvent(projectRoot, event);

		const content = await readFile(join(artifactDir, "orchestration.jsonl"), "utf-8");
		expect(content.trim().split("\n")).toHaveLength(1);
	});

	test("allows same event after 1s", async () => {
		const event = {
			projectRoot,
			domain: "session" as const,
			type: "fallback" as const,
			phase: "BUILD",
			agent: "oc-implementer",
			sessionId: "session-2",
		};

		appendForensicEvent(projectRoot, event);
		await new Promise((resolve) => setTimeout(resolve, 1100));
		appendForensicEvent(projectRoot, event);

		const content = await readFile(join(artifactDir, "orchestration.jsonl"), "utf-8");
		expect(content.trim().split("\n")).toHaveLength(2);
	});

	test("does not deduplicate different events", async () => {
		appendForensicEvent(projectRoot, {
			projectRoot,
			domain: "session",
			type: "fallback",
			phase: "BUILD",
			agent: "oc-implementer",
			sessionId: "session-3",
		});
		appendForensicEvent(projectRoot, {
			projectRoot,
			domain: "session",
			type: "error",
			phase: "BUILD",
			agent: "oc-implementer",
			sessionId: "session-3",
		});

		const content = await readFile(join(artifactDir, "orchestration.jsonl"), "utf-8");
		expect(content.trim().split("\n")).toHaveLength(2);
	});

	test("prunes stale cache entries when size grows too large", () => {
		let now = 1_000_000;
		Date.now = mock(() => now);

		for (let index = 0; index < 1_001; index += 1) {
			now = 1_000_000 + index;
			const result = isDuplicateEvent("fallback", `BUILD-${index}`, "oc-implementer");
			expect(result).toBe(false);
		}

		now = 1_012_500;
		const pruned = isDuplicateEvent("fallback", "BUILD-final", "oc-implementer");
		expect(pruned).toBe(false);
		expect(getDedupCacheSize()).toBe(1);
	});
});
