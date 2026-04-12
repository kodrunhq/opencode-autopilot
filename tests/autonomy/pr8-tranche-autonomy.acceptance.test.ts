import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autopilotAgent } from "../../src/agents/autopilot";
import { handlePlan } from "../../src/orchestrator/handlers/plan";
import { createInitialState } from "../../src/orchestrator/state";
import type { PipelineState } from "../../src/orchestrator/types";
import {
	buildPipelineIdeaForTranche,
	getCurrentTranche,
	planProgramRunFromRequest,
} from "../../src/program";
import { routeCore } from "../../src/tools/route";

describe("PR-8 acceptance — autonomous tranche policy", () => {
	let artifactDir = "";

	beforeEach(async () => {
		artifactDir = await mkdtemp(join(tmpdir(), "pr8-tranche-autonomy-"));
	});

	afterEach(async () => {
		await rm(artifactDir, { recursive: true, force: true });
	});

	test("matrix 2: autonomous control surfaces never ask which tranche to do first", async () => {
		const broadRequest = [
			"Implement the acceptance harness program:",
			"1. Add autonomous tranche planning.",
			"2. Continue automatically across multiple PRs.",
			"3. Gate ship on review and Oracle signoff.",
		].join("\n");

		const route = JSON.parse(
			routeCore({
				primaryIntent: "implementation",
				reasoning: "The request is a broad implementation program.",
				verbalization: "I detect implementation intent.",
			}),
		) as { instruction: string };

		const program = planProgramRunFromRequest(broadRequest, "strict");
		if (program === null) {
			throw new Error("Expected a broad request to create a multi-tranche program");
		}

		const tranche = getCurrentTranche(program);
		if (tranche === null) {
			throw new Error("Expected the first tranche to be selected automatically");
		}

		const planState: PipelineState = {
			...createInitialState(buildPipelineIdeaForTranche(program, tranche), {
				programContext: {
					programId: program.programId,
					trancheId: tranche.trancheId,
					trancheTitle: tranche.title,
					trancheIndex: tranche.sequence,
					trancheCount: program.tranches.length,
					selectionRationale: tranche.selectionRationale,
					originatingRequest: program.originatingRequest,
					mode: program.mode,
				},
			}),
			currentPhase: "PLAN",
			phases: createInitialState("placeholder").phases.map((phase) =>
				["RECON", "CHALLENGE", "ARCHITECT"].includes(phase.name)
					? { ...phase, status: "DONE" as const }
					: phase.name === "PLAN"
						? { ...phase, status: "IN_PROGRESS" as const }
						: phase,
			),
		};

		const architectDir = join(artifactDir, "phases", planState.runId, "ARCHITECT");
		await mkdir(architectDir, { recursive: true });
		await writeFile(join(architectDir, "design.md"), "# Design\n\nAcceptance harness.", "utf-8");

		const planDispatch = await handlePlan(planState, artifactDir);

		expect(route.instruction).toContain("do not ask which tranche to start");
		expect(route.instruction).toContain("tranches automatically");
		expect(autopilotAgent.prompt).toContain("DO NOT ask the user which tranche to do first");
		expect(tranche.selectionRationale).toContain("Selected automatically");
		expect(planState.idea).toContain("Execute only this tranche scope");
		expect(planState.idea).toContain("controller will automatically continue");
		expect(planDispatch.action).toBe("dispatch");
		expect(planDispatch.prompt).toContain("Plan ONLY this tranche scope");
		expect(planDispatch.prompt).toContain("Do not ask which tranche to do first");
		expect(planDispatch.prompt).not.toContain("Would you like");
	});
});
