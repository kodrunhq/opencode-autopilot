import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mockGetMemoryTunedDepth = mock(() => 1);
mock.module("../../../src/orchestrator/arena", () => ({
	getMemoryTunedDepth: mockGetMemoryTunedDepth,
}));

const mockFilterByPhase = mock(() => []);
mock.module("../../../src/orchestrator/confidence", () => ({
	filterByPhase: mockFilterByPhase,
}));

const mockGetProjectRootFromArtifactDir = mock((dir: string) => dir);
mock.module("../../../src/utils/paths", () => ({
	getProjectRootFromArtifactDir: mockGetProjectRootFromArtifactDir,
}));

import { handleArchitect } from "../../../src/orchestrator/handlers/architect";
import type { PipelineState } from "../../../src/orchestrator/types";

function makeState(overrides: Partial<PipelineState> = {}): PipelineState {
	return {
		schemaVersion: 2 as const,
		idea: "Test idea",
		currentPhase: "ARCHITECT",
		status: "IN_PROGRESS",
		phaseResults: {},
		decisions: [],
		confidence: { overall: "HIGH", entries: [] },
		arena: null,
		runId: "test-run-123",
		build: {
			tasks: [],
			currentTaskIndex: 0,
			completedWaves: [],
			reviewOutcome: null,
		},
		...overrides,
	} as PipelineState;
}

describe("handleArchitect", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "architect-test-"));
		mockGetMemoryTunedDepth.mockReset();
		mockFilterByPhase.mockReset();
		mockGetMemoryTunedDepth.mockReturnValue(1);
		mockFilterByPhase.mockReturnValue([]);
	});

	test("returns error when result is truthy but design.md missing in single mode", async () => {
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		await mkdir(artifactDir, { recursive: true });

		const dispatch = await handleArchitect(state, artifactDir, "some result");

		expect(dispatch.action).toBe("error");
		expect(dispatch.phase).toBe("ARCHITECT");
		expect(dispatch.message).toContain("did not write the required artifact");
		expect(dispatch.message).toContain("design.md");
	});

	test("returns complete when result is truthy and design.md exists in single mode", async () => {
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		const phaseDir = join(artifactDir, "phases", state.runId, "ARCHITECT");
		await mkdir(phaseDir, { recursive: true });
		await writeFile(join(phaseDir, "design.md"), "# Design");

		const dispatch = await handleArchitect(state, artifactDir, "some result");

		expect(dispatch.action).toBe("complete");
		expect(dispatch.phase).toBe("ARCHITECT");
		expect(dispatch.progress).toBe("ARCHITECT complete");
	});

	test("returns error when result is truthy but proposals incomplete in arena mode", async () => {
		mockGetMemoryTunedDepth.mockReturnValue(2);
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		const phaseDir = join(artifactDir, "phases", state.runId, "ARCHITECT");
		const proposalsDir = join(phaseDir, "proposals");
		await mkdir(proposalsDir, { recursive: true });
		await writeFile(join(proposalsDir, "proposal-A.md"), "# Proposal A");

		const dispatch = await handleArchitect(state, artifactDir, "some result");

		expect(dispatch.action).toBe("error");
		expect(dispatch.phase).toBe("ARCHITECT");
		expect(dispatch.message).toContain("did not write all required proposals");
		expect(dispatch.message).toContain("expected 2 proposals");
		expect(dispatch.message).toContain("found 1");
	});

	test("returns dispatch critic when result is truthy and all proposals exist in arena mode", async () => {
		mockGetMemoryTunedDepth.mockReturnValue(2);
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		const phaseDir = join(artifactDir, "phases", state.runId, "ARCHITECT");
		const proposalsDir = join(phaseDir, "proposals");
		await mkdir(proposalsDir, { recursive: true });
		await writeFile(join(proposalsDir, "proposal-A.md"), "# Proposal A");
		await writeFile(join(proposalsDir, "proposal-B.md"), "# Proposal B");

		const dispatch = await handleArchitect(state, artifactDir, "some result");

		expect(dispatch.action).toBe("dispatch");
		expect(dispatch.agent).toBe("oc-critic");
		expect(dispatch.phase).toBe("ARCHITECT");
		expect(dispatch.progress).toBe("Dispatching critic for proposal review");
	});

	test("returns complete when result is truthy and critique.md exists", async () => {
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		const phaseDir = join(artifactDir, "phases", state.runId, "ARCHITECT");
		await mkdir(phaseDir, { recursive: true });
		await writeFile(join(phaseDir, "critique.md"), "# Critique");

		const dispatch = await handleArchitect(state, artifactDir, "some result");

		expect(dispatch.action).toBe("complete");
		expect(dispatch.phase).toBe("ARCHITECT");
		expect(dispatch.progress).toBe("ARCHITECT complete");
	});

	test("returns dispatch architect when no result and depth=1", async () => {
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		await mkdir(artifactDir, { recursive: true });

		const dispatch = await handleArchitect(state, artifactDir);

		expect(dispatch.action).toBe("dispatch");
		expect(dispatch.agent).toBe("oc-architect");
		expect(dispatch.phase).toBe("ARCHITECT");
		expect(dispatch.progress).toBe("Dispatching architect for design");
	});

	test("returns dispatch_multi when no result and depth>1", async () => {
		mockGetMemoryTunedDepth.mockReturnValue(2);
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		await mkdir(artifactDir, { recursive: true });

		const dispatch = await handleArchitect(state, artifactDir);

		expect(dispatch.action).toBe("dispatch_multi");
		expect(dispatch.agents).toHaveLength(2);
		expect(dispatch.phase).toBe("ARCHITECT");
		expect(dispatch.progress).toContain("Dispatching 2 architects");
	});

	test("returns complete when critique exists without result (resume case)", async () => {
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		const phaseDir = join(artifactDir, "phases", state.runId, "ARCHITECT");
		await mkdir(phaseDir, { recursive: true });
		await writeFile(join(phaseDir, "critique.md"), "# Critique");

		const dispatch = await handleArchitect(state, artifactDir);

		expect(dispatch.action).toBe("complete");
		expect(dispatch.phase).toBe("ARCHITECT");
	});

	test("returns complete when design exists without result (resume case)", async () => {
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		const phaseDir = join(artifactDir, "phases", state.runId, "ARCHITECT");
		await mkdir(phaseDir, { recursive: true });
		await writeFile(join(phaseDir, "design.md"), "# Design");

		const dispatch = await handleArchitect(state, artifactDir);

		expect(dispatch.action).toBe("complete");
		expect(dispatch.phase).toBe("ARCHITECT");
	});

	test("returns dispatch critic when proposals exist without result (resume case)", async () => {
		mockGetMemoryTunedDepth.mockReturnValue(2);
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		const phaseDir = join(artifactDir, "phases", state.runId, "ARCHITECT");
		const proposalsDir = join(phaseDir, "proposals");
		await mkdir(proposalsDir, { recursive: true });
		await writeFile(join(proposalsDir, "proposal-A.md"), "# Proposal A");
		await writeFile(join(proposalsDir, "proposal-B.md"), "# Proposal B");

		const dispatch = await handleArchitect(state, artifactDir);

		expect(dispatch.action).toBe("dispatch");
		expect(dispatch.agent).toBe("oc-critic");
		expect(dispatch.phase).toBe("ARCHITECT");
	});

	test("returns error when partial proposals exist without result (resume case)", async () => {
		mockGetMemoryTunedDepth.mockReturnValue(2);
		const state = makeState();
		const artifactDir = join(tempDir, "artifacts");
		const phaseDir = join(artifactDir, "phases", state.runId, "ARCHITECT");
		const proposalsDir = join(phaseDir, "proposals");
		await mkdir(proposalsDir, { recursive: true });
		await writeFile(join(proposalsDir, "proposal-A.md"), "# Proposal A");

		const dispatch = await handleArchitect(state, artifactDir);

		expect(dispatch.action).toBe("error");
		expect(dispatch.phase).toBe("ARCHITECT");
		expect(dispatch.message).toContain("expected 2 proposals");
		expect(dispatch.message).toContain("only 1 were written");
	});
});
