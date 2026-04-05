import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { confidenceCore } from "../../src/tools/confidence";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "confidence-tool-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("confidenceCore", () => {
	test("append adds confidence entry and saves state", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);
		const result = await confidenceCore(
			{
				subcommand: "append",
				phase: "RECON",
				agent: "test",
				area: "research",
				level: "HIGH",
				rationale: "solid evidence",
			},
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.ok).toBe(true);
		expect(parsed.entries).toBe(1);
	});

	test("summary returns confidence counts", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);
		// Add an entry first
		await confidenceCore(
			{
				subcommand: "append",
				phase: "RECON",
				agent: "test",
				area: "research",
				level: "HIGH",
				rationale: "solid",
			},
			tempDir,
		);
		const result = await confidenceCore({ subcommand: "summary" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.total).toBe(1);
		expect(parsed.HIGH).toBe(1);
	});

	test("filter returns entries for specified phase", async () => {
		const state = createInitialState("test idea");
		await saveState(state, tempDir);
		await confidenceCore(
			{
				subcommand: "append",
				phase: "RECON",
				agent: "test",
				area: "research",
				level: "HIGH",
				rationale: "solid",
			},
			tempDir,
		);
		const result = await confidenceCore({ subcommand: "filter", phase: "RECON" }, tempDir);
		const parsed = JSON.parse(result);
		expect(parsed.entries).toHaveLength(1);
		expect(parsed.entries[0].phase).toBe("RECON");
	});

	test("append returns error when no state exists", async () => {
		const result = await confidenceCore(
			{
				subcommand: "append",
				phase: "RECON",
				agent: "test",
				area: "research",
				level: "HIGH",
				rationale: "solid",
			},
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.error).toBeDefined();
	});

	test("unknown subcommand returns error", async () => {
		const result = await confidenceCore(
			{ subcommand: "nonexistent" as "append" | "summary" | "filter" },
			tempDir,
		);
		const parsed = JSON.parse(result);
		expect(parsed.error).toContain("unknown subcommand");
	});
});
