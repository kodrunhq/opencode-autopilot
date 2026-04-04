import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initMemoryDb } from "../../src/memory/database";
import { retrieveMemoryContext } from "../../src/memory/retrieval";
import { loadAdaptiveSkillContext } from "../../src/orchestrator/skill-injection";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import type { Phase } from "../../src/orchestrator/types";
import { orchestrateCore } from "../../src/tools/orchestrate";

describe("Cross-feature integration: orchestrator + skills + memory", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "cross-feature-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("orchestrateCore with idea dispatches RECON with valid prompt", async () => {
		const result = await orchestrateCore({ idea: "cross-feature integration test" }, tempDir);
		const parsed = JSON.parse(result);

		expect(parsed.action).toBe("dispatch");
		expect(parsed.agent).toBeDefined();
		expect(parsed.phase).toBe("RECON");
		expect(typeof parsed.prompt).toBe("string");
		expect(parsed.prompt).toContain("cross-feature integration test");
	});

	test("loadAdaptiveSkillContext returns empty string from empty state (best-effort)", async () => {
		// tempDir has no skills directory — should return "" without throwing
		const result = await loadAdaptiveSkillContext(tempDir, tempDir);
		expect(result).toBe("");
	});

	test("retrieveMemoryContext returns empty string when no project registered (best-effort)", () => {
		// Use an in-memory DB to avoid touching global singleton
		const db = new Database(":memory:");
		initMemoryDb(db);
		const result = retrieveMemoryContext(tempDir, undefined, db);
		expect(result).toBe("");
		db.close();
	});

	test("combined enrichment does not corrupt dispatch JSON", async () => {
		const result = await orchestrateCore({ idea: "integration test validation" }, tempDir);
		const parsed = JSON.parse(result);

		// Core dispatch fields must all be present and valid
		expect(parsed.action).toBe("dispatch");
		expect(typeof parsed.agent).toBe("string");
		expect(typeof parsed.prompt).toBe("string");
		expect(parsed.agent.length).toBeGreaterThan(0);
		expect(parsed.prompt.length).toBeGreaterThan(0);
	});

	test("dispatch_multi enrichment produces valid JSON with enriched prompts", async () => {
		// Set up state at ARCHITECT phase with MEDIUM confidence to trigger Arena (depth=2)
		const state = createInitialState("multi dispatch test");
		const architectState = {
			...state,
			currentPhase: "ARCHITECT" as Phase,
			confidence: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					level: "MEDIUM" as const,
					area: "general",
					rationale: "moderate signal",
					timestamp: new Date().toISOString(),
				},
			],
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "ARCHITECT"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(architectState, tempDir);

		// Resume at ARCHITECT with no result — MEDIUM confidence triggers dispatch_multi
		const result = await orchestrateCore({}, tempDir);
		const parsed = JSON.parse(result);

		expect(parsed.action).toBe("dispatch_multi");
		expect(Array.isArray(parsed.agents)).toBe(true);
		expect(parsed.agents.length).toBeGreaterThan(0);

		// Each agent entry must have a valid prompt string
		for (const entry of parsed.agents) {
			expect(typeof entry.prompt).toBe("string");
			expect(entry.prompt.length).toBeGreaterThan(0);
		}
	});

	test("skill injection and memory retrieval both return gracefully from empty state", async () => {
		// Both should return empty strings without errors
		const [skillResult, memoryResult] = await Promise.all([
			loadAdaptiveSkillContext(tempDir, tempDir),
			Promise.resolve(retrieveMemoryContext(tempDir)),
		]);

		expect(skillResult).toBe("");
		expect(memoryResult).toBe("");
	});
});
