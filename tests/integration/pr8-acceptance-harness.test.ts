import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadState, saveState } from "../../src/orchestrator/state";
import {
	buildPipelineIdeaForTranche,
	getCurrentTranche,
	loadLatestProgramRunFromKernel,
	markCurrentTrancheShipped,
	type ProgramRun,
	planProgramRunFromRequest,
	saveProgramRunToKernel,
} from "../../src/program";
import { orchestrateCore } from "../../src/tools/orchestrate";
import { createToolVisibilityProjectionHandler } from "../../src/ux/visibility";

const BROAD_REQUEST = [
	"Implement the remediation acceptance harness:",
	"1. Add autonomous tranche planning.",
	"2. Continue automatically across multiple PRs.",
	"3. Gate ship on review, Oracle signoff, and CI.",
	"Acceptance criteria:",
	"- Tranche 1 starts automatically.",
].join("\n");

function projectSummary(rawOutput: string): string {
	const output = { title: "oc_orchestrate", output: rawOutput, metadata: null };
	createToolVisibilityProjectionHandler({ visibilityMode: "summary" })(
		{ tool: "oc_orchestrate", sessionID: "session-pr8", callID: "call-pr8", args: {} },
		output,
	);
	return output.output;
}

describe("PR-8 acceptance — integrated tranche lifecycle", () => {
	let artifactDir = "";

	beforeEach(async () => {
		artifactDir = await mkdtemp(join(tmpdir(), "pr8-integration-"));
	});

	afterEach(async () => {
		await rm(artifactDir, { recursive: true, force: true });
	});

	test("matrix 2 + 7 + 8: broad requests start automatically with curated, reasoning-free operator output", async () => {
		const rawOutput = await orchestrateCore(
			{ idea: BROAD_REQUEST, intent: "implementation" },
			artifactDir,
		);
		const parsed = JSON.parse(rawOutput) as {
			action: string;
			phase: string;
			program?: {
				trancheIndex: number;
				trancheCount: number;
				selectionRationale: string;
			};
		};
		const projected = projectSummary(rawOutput);

		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.program?.trancheIndex).toBe(1);
		expect(parsed.program?.trancheCount).toBeGreaterThan(1);
		expect(parsed.program?.selectionRationale).toContain("Selected automatically");

		expect(projected).toContain("Tranche 1/");
		expect(projected).toContain("[1/8]");
		expect(projected).not.toContain('"action"');
		expect(projected).not.toContain('"prompt"');
		expect(projected).not.toContain("_Thinking:");
		expect(projected).not.toContain("Reasoning:");
		expect(projected.toLowerCase()).not.toContain("which tranche");

		const state = await loadState(artifactDir);
		expect(state?.programContext?.trancheIndex).toBe(1);
		expect(state?.idea).toContain("Execute only this tranche scope");
		expect(state?.idea).toContain("controller will automatically continue");
	});

	test("matrix 3: completing tranche 1 automatically continues the persisted backlog with tranche 2", async () => {
		await orchestrateCore({ idea: BROAD_REQUEST, intent: "implementation" }, artifactDir);

		const activeState = await loadState(artifactDir);
		if (!activeState?.programContext) {
			throw new Error("Expected the broad request to create program context");
		}

		const initialProgram = loadLatestProgramRunFromKernel(artifactDir);
		if (initialProgram === null) {
			throw new Error("Expected the broad request to persist a program run");
		}

		saveProgramRunToKernel(
			artifactDir,
			markCurrentTrancheShipped(initialProgram, `manifest_${activeState.runId}`),
		);

		await saveState(
			{
				...activeState,
				currentPhase: "RETROSPECTIVE",
				phases: activeState.phases.map((phase) =>
					["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN", "BUILD", "SHIP"].includes(
						phase.name,
					)
						? { ...phase, status: "DONE" as const }
						: { ...phase, status: "IN_PROGRESS" as const },
				),
				pendingDispatches: [
					{
						dispatchId: "dispatch_pr8_retrospective",
						phase: "RETROSPECTIVE",
						agent: "oc-retrospector",
						issuedAt: new Date().toISOString(),
						resultKind: "phase_output",
						taskId: null,
						sessionId: null,
					},
				],
			},
			artifactDir,
		);

		const rawOutput = await orchestrateCore(
			{
				result: JSON.stringify({
					schemaVersion: 1,
					resultId: "pr8-retrospective-result",
					runId: activeState.runId,
					phase: "RETROSPECTIVE",
					dispatchId: "dispatch_pr8_retrospective",
					agent: "oc-retrospector",
					kind: "phase_output",
					taskId: null,
					payload: { text: JSON.stringify({ lessons: [] }) },
				}),
			},
			artifactDir,
		);
		const parsed = JSON.parse(rawOutput) as {
			action: string;
			phase: string;
			program?: { trancheIndex: number };
		};
		const projected = projectSummary(rawOutput);

		expect(parsed.action).toBe("dispatch");
		expect(parsed.phase).toBe("RECON");
		expect(parsed.program?.trancheIndex).toBe(2);
		expect(projected).toContain("Tranche 2/");
		expect(projected.toLowerCase()).not.toContain("which tranche");

		const advancedProgram = loadLatestProgramRunFromKernel(artifactDir);
		expect(advancedProgram?.tranches[0]?.status).toBe("COMPLETED");
		expect(advancedProgram?.tranches[1]?.status).toBe("IN_PROGRESS");
	});

	test("matrix 9+10: program Oracle signoff is required before final COMPLETED", async () => {
		const program = planProgramRunFromRequest(BROAD_REQUEST, "standard");
		if (!program) throw new Error("Expected planProgramRunFromRequest to return a program");
		saveProgramRunToKernel(artifactDir, program);

		const tranche0 = getCurrentTranche(program);
		if (!tranche0) throw new Error("Expected at least one tranche");

		const shipped = markCurrentTrancheShipped(program, `manifest_${program.programId}`);
		saveProgramRunToKernel(artifactDir, shipped);

		const tranche1 = getCurrentTranche(shipped);
		if (tranche1) {
			const shipped2 = markCurrentTrancheShipped(shipped, `manifest_${program.programId}_t2`);
			saveProgramRunToKernel(artifactDir, shipped2);
		}

		const finalProgram = loadLatestProgramRunFromKernel(artifactDir);
		expect(finalProgram).not.toBeNull();

		if (finalProgram && finalProgram.tranches.every((t) => t.status === "COMPLETED")) {
			expect(finalProgram.status).not.toBe("COMPLETED");
			expect(finalProgram.finalOracleVerdict).toBeDefined();
		}
	});

	test("matrix 3+10: canonical mode drives autonomous behavior in planProgramRunFromRequest", () => {
		const autonomousProgram = planProgramRunFromRequest(BROAD_REQUEST, "standard", {
			executionMode: "autonomous",
		});
		const interactiveProgram = planProgramRunFromRequest(BROAD_REQUEST, "standard", {
			executionMode: "interactive",
		});

		expect(autonomousProgram).not.toBeNull();
		expect(interactiveProgram).not.toBeNull();

		if (autonomousProgram) {
			expect(autonomousProgram.tranches.length).toBeGreaterThan(1);
		}

		if (interactiveProgram) {
			expect(interactiveProgram.tranches.length).toBeGreaterThanOrEqual(1);
		}
	});
});
