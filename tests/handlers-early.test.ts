import { describe, expect, test } from "bun:test";
import type { PipelineState } from "../src/orchestrator/types";

// Minimal state factory for handler tests
function makeState(overrides: Partial<PipelineState> = {}): PipelineState {
	const now = new Date().toISOString();
	return {
		schemaVersion: 2,
		status: "IN_PROGRESS",
		idea: "Build a CLI tool for managing dotfiles",
		currentPhase: "RECON",
		startedAt: now,
		lastUpdatedAt: now,
		phases: [
			{ name: "RECON", phaseNumber: 1, status: "IN_PROGRESS" },
			{ name: "CHALLENGE", phaseNumber: 2, status: "PENDING" },
			{ name: "ARCHITECT", phaseNumber: 3, status: "PENDING" },
			{ name: "EXPLORE", phaseNumber: 4, status: "PENDING" },
			{ name: "PLAN", phaseNumber: 5, status: "PENDING" },
			{ name: "BUILD", phaseNumber: 6, status: "PENDING" },
			{ name: "SHIP", phaseNumber: 7, status: "PENDING" },
			{ name: "RETROSPECTIVE", phaseNumber: 8, status: "PENDING" },
		],
		decisions: [],
		confidence: [],
		tasks: [],
		arenaConfidence: null,
		exploreTriggered: false,
		...overrides,
	} as PipelineState;
}

describe("handleRecon", () => {
	test("returns dispatch with oc-researcher agent", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const state = makeState();
		const result = await handleRecon(state, "/tmp/test-artifacts");

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-researcher");
		expect(result.phase).toBe("RECON");
	});

	test("prompt includes idea text", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const state = makeState({ idea: "A tool for dotfile management" });
		const result = await handleRecon(state, "/tmp/test-artifacts");

		expect(result.prompt).toContain("A tool for dotfile management");
	});

	test("prompt includes absolute artifact path reference", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const state = makeState();
		const result = await handleRecon(state, "/tmp/test-artifacts");

		expect(result.prompt).toContain("/tmp/test-artifacts/phases/RECON/report.md");
	});

	test("prompt does NOT include content from other phases", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const state = makeState();
		const result = await handleRecon(state, "/tmp/test-artifacts");

		expect(result.prompt).not.toContain("CHALLENGE");
		expect(result.prompt).not.toContain("ARCHITECT");
	});

	test("returns complete when result is provided", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const fs = await import("node:fs/promises");
		const tmpDir = `/tmp/test-recon-complete-${Date.now()}`;
		const artifactPath = `${tmpDir}/phases/RECON/report.md`;
		await fs.mkdir(`${tmpDir}/phases/RECON`, { recursive: true });
		await fs.writeFile(artifactPath, "# Report\nContent");

		const state = makeState();
		const result = await handleRecon(state, tmpDir, "done");

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("RECON");
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	test("returned DispatchResult is frozen", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const state = makeState();
		const result = await handleRecon(state, "/tmp/test-artifacts");

		expect(Object.isFrozen(result)).toBe(true);
	});
});

describe("handleChallenge", () => {
	test("returns dispatch with oc-challenger agent", async () => {
		const { handleChallenge } = await import("../src/orchestrator/handlers/challenge");
		const state = makeState({ currentPhase: "CHALLENGE" });
		const result = await handleChallenge(state, "/tmp/test-artifacts");

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-challenger");
		expect(result.phase).toBe("CHALLENGE");
	});

	test("prompt references absolute RECON artifacts path", async () => {
		const { handleChallenge } = await import("../src/orchestrator/handlers/challenge");
		const state = makeState({ currentPhase: "CHALLENGE" });
		const result = await handleChallenge(state, "/tmp/test-artifacts");

		expect(result.prompt).toContain("/tmp/test-artifacts/phases/RECON/report.md");
	});

	test("returns complete when result is provided", async () => {
		const { handleChallenge } = await import("../src/orchestrator/handlers/challenge");
		const fs = await import("node:fs/promises");
		const tmpDir = `/tmp/test-challenge-complete-${Date.now()}`;
		const artifactPath = `${tmpDir}/phases/CHALLENGE/brief.md`;
		await fs.mkdir(`${tmpDir}/phases/CHALLENGE`, { recursive: true });
		await fs.writeFile(artifactPath, "# Brief\nContent");

		const state = makeState({ currentPhase: "CHALLENGE" });
		const result = await handleChallenge(state, tmpDir, "done");

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("CHALLENGE");
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	test("returned DispatchResult is frozen", async () => {
		const { handleChallenge } = await import("../src/orchestrator/handlers/challenge");
		const state = makeState({ currentPhase: "CHALLENGE" });
		const result = await handleChallenge(state, "/tmp/test-artifacts");

		expect(Object.isFrozen(result)).toBe(true);
	});
});

describe("handleArchitect", () => {
	test("HIGH confidence (depth=1) returns single dispatch to oc-architect", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const state = makeState({
			currentPhase: "ARCHITECT",
			confidence: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					level: "HIGH",
					area: "general",
					rationale: "strong signal",
					timestamp: new Date().toISOString(),
				},
			],
		});
		const result = await handleArchitect(state, "/tmp/test-artifacts");

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-architect");
		expect(result.phase).toBe("ARCHITECT");
	});

	test("MEDIUM confidence (depth=2) returns dispatch_multi with 2 entries", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const state = makeState({
			currentPhase: "ARCHITECT",
			confidence: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					level: "MEDIUM",
					area: "general",
					rationale: "moderate signal",
					timestamp: new Date().toISOString(),
				},
			],
		});
		const result = await handleArchitect(state, "/tmp/test-artifacts");

		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(2);
		expect(result.agents?.[0].agent).toBe("oc-architect");
		expect(result.agents?.[1].agent).toBe("oc-architect");
	});

	test("LOW confidence (depth=3) returns dispatch_multi with 3 entries", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const state = makeState({
			currentPhase: "ARCHITECT",
			confidence: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					level: "LOW",
					area: "general",
					rationale: "weak signal",
					timestamp: new Date().toISOString(),
				},
			],
		});
		const result = await handleArchitect(state, "/tmp/test-artifacts");

		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(3);
	});

	test("after proposals exist, dispatches oc-critic", async () => {
		// Test with actual files to verify artifact-existence idempotency
		const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
		const tmpDir = `/tmp/test-architect-critic-${Date.now()}`;
		const phaseDir = `${tmpDir}/phases/ARCHITECT`;
		const proposalsDir = `${phaseDir}/proposals`;
		mkdirSync(proposalsDir, { recursive: true });
		writeFileSync(`${proposalsDir}/proposal-A.md`, "proposal A");
		writeFileSync(`${proposalsDir}/proposal-B.md`, "proposal B");

		try {
			const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
			const state = makeState({
				currentPhase: "ARCHITECT",
				confidence: [
					{
						phase: "RECON",
						agent: "oc-researcher",
						level: "MEDIUM",
						area: "general",
						rationale: "moderate signal",
						timestamp: new Date().toISOString(),
					},
				],
			});
			const result = await handleArchitect(state, tmpDir);

			expect(result.action).toBe("dispatch");
			expect(result.agent).toBe("oc-critic");
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test("after critique exists, returns complete", async () => {
		const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
		const tmpDir = `/tmp/test-architect-complete-${Date.now()}`;
		const phaseDir = `${tmpDir}/phases/ARCHITECT`;
		mkdirSync(phaseDir, { recursive: true });
		writeFileSync(`${phaseDir}/critique.md`, "critique content");

		try {
			const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
			const state = makeState({
				currentPhase: "ARCHITECT",
				confidence: [
					{
						phase: "RECON",
						agent: "oc-researcher",
						level: "MEDIUM",
						area: "general",
						rationale: "moderate signal",
						timestamp: new Date().toISOString(),
					},
				],
			});
			const result = await handleArchitect(state, tmpDir);

			expect(result.action).toBe("complete");
			expect(result.phase).toBe("ARCHITECT");
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test("prompt includes absolute artifact refs to RECON and CHALLENGE", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const state = makeState({
			currentPhase: "ARCHITECT",
			confidence: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					level: "HIGH",
					area: "general",
					rationale: "strong signal",
					timestamp: new Date().toISOString(),
				},
			],
		});
		const result = await handleArchitect(state, "/tmp/test-artifacts");

		expect(result.prompt).toContain("/tmp/test-artifacts/phases/RECON/report.md");
		expect(result.prompt).toContain("/tmp/test-artifacts/phases/CHALLENGE/brief.md");
	});

	test("result with existing design.md returns complete (no infinite loop)", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const state = makeState({ currentPhase: "ARCHITECT", confidence: [] });

		// Simulate the agent having written design.md
		const fs = await import("node:fs/promises");
		const phaseDir = "/tmp/test-artifacts/phases/ARCHITECT";
		await fs.mkdir(phaseDir, { recursive: true });
		await fs.writeFile(`${phaseDir}/design.md`, "# Design\ntest content");

		const result = await handleArchitect(state, "/tmp/test-artifacts", "architecture done");
		expect(result.action).toBe("complete");
		expect(result.phase).toBe("ARCHITECT");

		await fs.rm(phaseDir, { recursive: true, force: true });
	});

	test("result with existing proposals dispatches critic (arena path)", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const state = makeState({ currentPhase: "ARCHITECT", confidence: [] });

		// Simulate proposal files from dispatch_multi
		const fs = await import("node:fs/promises");
		const proposalsDir = "/tmp/test-artifacts/phases/ARCHITECT/proposals";
		await fs.mkdir(proposalsDir, { recursive: true });
		await fs.writeFile(`${proposalsDir}/proposal-A.md`, "# Proposal A");

		const result = await handleArchitect(state, "/tmp/test-artifacts", "proposals written");
		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-critic");

		await fs.rm("/tmp/test-artifacts/phases/ARCHITECT", { recursive: true, force: true });
	});

	test("each multi-dispatch proposal has distinct constraint framing", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const state = makeState({
			currentPhase: "ARCHITECT",
			confidence: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					level: "LOW",
					area: "general",
					rationale: "weak signal",
					timestamp: new Date().toISOString(),
				},
			],
		});
		const result = await handleArchitect(state, "/tmp/test-artifacts");

		const prompts = result.agents?.map((a) => a.prompt) ?? [];
		expect(prompts[0]).toContain("simplicity");
		expect(prompts[1]).toContain("extensibility");
		expect(prompts[2]).toContain("performance");
	});

	test("returned DispatchResult is frozen", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const state = makeState({
			currentPhase: "ARCHITECT",
			confidence: [
				{
					phase: "RECON",
					agent: "oc-researcher",
					level: "HIGH",
					area: "general",
					rationale: "strong signal",
					timestamp: new Date().toISOString(),
				},
			],
		});
		const result = await handleArchitect(state, "/tmp/test-artifacts");

		expect(Object.isFrozen(result)).toBe(true);
	});
});
