import { beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PipelineState } from "../src/orchestrator/types";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "handler-test-"));
});

// Minimal state factory for handler tests (non-run-scoped paths)
function makeState(overrides: Partial<PipelineState> = {}): PipelineState {
	return {
		schemaVersion: 2,
		status: "IN_PROGRESS",
		idea: "Build a CLI tool for managing dotfiles",
		currentPhase: "RECON",
		startedAt: new Date().toISOString(),
		lastUpdatedAt: new Date().toISOString(),
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
		const result = await handleRecon(state, tempDir);

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-researcher");
		expect(result.phase).toBe("RECON");
	});

	test("prompt includes idea text", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const state = makeState({ idea: "A tool for dotfile management" });
		const result = await handleRecon(state, tempDir);

		expect(result.prompt).toContain("A tool for dotfile management");
	});

	test("prompt includes absolute artifact path reference", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const state = makeState();
		const result = await handleRecon(state, tempDir);

		expect(result.prompt).toContain(`${tempDir}/phases/RECON/report.md`);
	});

	test("prompt does NOT include content from other phases", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const state = makeState();
		const result = await handleRecon(state, tempDir);

		expect(result.prompt).not.toContain("CHALLENGE");
		expect(result.prompt).not.toContain("ARCHITECT");
	});

	test("returns complete when result is provided", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const artifactDir = join(tempDir, "artifacts");
		const artifactPath = join(artifactDir, "phases", "RECON", "report.md");
		await mkdir(join(artifactDir, "phases", "RECON"), { recursive: true });
		await writeFile(artifactPath, "# Report\nContent");

		const state = makeState();
		const result = await handleRecon(state, artifactDir, "done");

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("RECON");
	});

	test("returned DispatchResult is frozen", async () => {
		const { handleRecon } = await import("../src/orchestrator/handlers/recon");
		const state = makeState();
		const result = await handleRecon(state, tempDir);

		expect(Object.isFrozen(result)).toBe(true);
	});
});

describe("handleChallenge", () => {
	test("returns dispatch with oc-challenger agent", async () => {
		const { handleChallenge } = await import("../src/orchestrator/handlers/challenge");
		const state = makeState({ currentPhase: "CHALLENGE" });
		const result = await handleChallenge(state, tempDir);

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-challenger");
		expect(result.phase).toBe("CHALLENGE");
	});

	test("prompt references absolute RECON artifacts path", async () => {
		const { handleChallenge } = await import("../src/orchestrator/handlers/challenge");
		const state = makeState({ currentPhase: "CHALLENGE" });
		const result = await handleChallenge(state, tempDir);

		expect(result.prompt).toContain(`${tempDir}/phases/RECON/report.md`);
	});

	test("returns complete when result is provided", async () => {
		const { handleChallenge } = await import("../src/orchestrator/handlers/challenge");
		const artifactDir = join(tempDir, "artifacts");
		const artifactPath = join(artifactDir, "phases", "CHALLENGE", "brief.md");
		await mkdir(join(artifactDir, "phases", "CHALLENGE"), { recursive: true });
		await writeFile(artifactPath, "# Brief\nContent");

		const state = makeState({ currentPhase: "CHALLENGE" });
		const result = await handleChallenge(state, artifactDir, "done");

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("CHALLENGE");
	});

	test("returned DispatchResult is frozen", async () => {
		const { handleChallenge } = await import("../src/orchestrator/handlers/challenge");
		const state = makeState({ currentPhase: "CHALLENGE" });
		const result = await handleChallenge(state, tempDir);

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
		const result = await handleArchitect(state, tempDir);

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
		const result = await handleArchitect(state, tempDir);

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
		const result = await handleArchitect(state, tempDir);

		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(3);
	});

	test("after proposals exist, dispatches oc-critic", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const phaseDir = join(tempDir, "phases", "ARCHITECT");
		const proposalsDir = join(phaseDir, "proposals");
		await mkdir(proposalsDir, { recursive: true });
		await writeFile(join(proposalsDir, "proposal-A.md"), "proposal A");
		await writeFile(join(proposalsDir, "proposal-B.md"), "proposal B");

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
		const result = await handleArchitect(state, tempDir);

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-critic");
	});

	test("after critique exists, returns complete", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const phaseDir = join(tempDir, "phases", "ARCHITECT");
		await mkdir(phaseDir, { recursive: true });
		await writeFile(join(phaseDir, "critique.md"), "critique content");

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
		const result = await handleArchitect(state, tempDir);

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("ARCHITECT");
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
		const result = await handleArchitect(state, tempDir);

		expect(result.prompt).toContain(`${tempDir}/phases/RECON/report.md`);
		expect(result.prompt).toContain(`${tempDir}/phases/CHALLENGE/brief.md`);
	});

	test("result with existing design.md returns complete (no infinite loop)", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const phaseDir = join(tempDir, "phases", "ARCHITECT");
		await mkdir(phaseDir, { recursive: true });
		await writeFile(join(phaseDir, "design.md"), "# Design\ntest content");

		const state = makeState({ currentPhase: "ARCHITECT", confidence: [] });
		const result = await handleArchitect(state, tempDir, "architecture done");
		expect(result.action).toBe("complete");
		expect(result.phase).toBe("ARCHITECT");
	});

	test("result with existing proposals dispatches critic (arena path)", async () => {
		const { handleArchitect } = await import("../src/orchestrator/handlers/architect");
		const proposalsDir = join(tempDir, "phases", "ARCHITECT", "proposals");
		await mkdir(proposalsDir, { recursive: true });
		await writeFile(join(proposalsDir, "proposal-A.md"), "# Proposal A");
		await writeFile(join(proposalsDir, "proposal-B.md"), "# Proposal B");

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
		const result = await handleArchitect(state, tempDir, "proposals written");
		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-critic");
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
		const result = await handleArchitect(state, tempDir);

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
		const result = await handleArchitect(state, tempDir);

		expect(Object.isFrozen(result)).toBe(true);
	});
});
