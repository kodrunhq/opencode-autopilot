import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initBranchLifecycle } from "../../src/orchestrator/handlers/branch-pr";
import { reviewStatusSchema } from "../../src/orchestrator/review-runner";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import {
	buildPipelineIdeaForTranche,
	planProgramRunFromRequest,
	saveProgramRunToKernel,
} from "../../src/program";
import { getProjectArtifactDir } from "../../src/utils/paths";
import { loadSidebarStateForProject, renderSidebarText } from "../../src/ux/sidebar";
import {
	createToolVisibilityProjectionHandler,
	createVisibilityBus,
	decorateOrchestrateResponse,
	sanitizeChatMessageParts,
} from "../../src/ux/visibility";

describe("PR-8 acceptance — visibility and sidebar", () => {
	let projectRoot = "";
	let artifactDir = "";

	beforeEach(async () => {
		projectRoot = await mkdtemp(join(tmpdir(), "pr8-ux-"));
		artifactDir = getProjectArtifactDir(projectRoot);
		await mkdir(artifactDir, { recursive: true });
		await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "pr8-ux" }), "utf-8");
	});

	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	test("matrix 7 + 8: summary-mode transcript stays curated and strips reasoning leakage", () => {
		const bus = createVisibilityBus({ artifactDir });
		bus.publish({
			type: "tranche_started",
			runId: "run_pr8_visibility",
			trancheId: "tranche_01",
			trancheIndex: 1,
			trancheCount: 3,
			summary: "Tranche 1/3 started — Acceptance harness",
		});
		bus.publish({
			type: "phase_started",
			runId: "run_pr8_visibility",
			phase: "RECON",
			summary: "[1/8] Researching feasibility...\n_Thinking: hidden rationale",
		});

		const rawOutput = decorateOrchestrateResponse(
			{
				action: "dispatch",
				prompt: "raw control-plane prompt that must stay hidden",
				displayText: "_Thinking: secret\n<reasoning>hide me</reasoning>\nVisible fallback",
			},
			bus,
		);
		const output = { title: "oc_orchestrate", output: rawOutput, metadata: null };
		createToolVisibilityProjectionHandler({ visibilityMode: "summary" })(
			{ tool: "oc_orchestrate", sessionID: "session-pr8", callID: "call-pr8", args: {} },
			output,
		);

		const parts: Array<Record<string, unknown>> = [
			{ type: "text", text: "Reasoning: private\nVisible update" },
			{ type: "text", text: "<thinking>internal</thinking>\nStill visible" },
		];
		sanitizeChatMessageParts(parts);

		expect(output.output).toContain("Tranche 1/3 started — Acceptance harness");
		expect(output.output).toContain("[1/8] Researching feasibility...");
		expect(output.output).not.toContain('"action"');
		expect(output.output).not.toContain("control-plane prompt");
		expect(output.output).not.toContain("_Thinking:");
		expect(output.output).not.toContain("Reasoning:");
		expect(output.output).not.toContain("<reasoning>");
		expect(parts).toEqual([
			{ type: "text", text: "Visible update" },
			{ type: "text", text: "Still visible" },
		]);
	});

	test("matrix 9: sidebar shows the structured plan and live progress without scraping transcript chatter", async () => {
		const program = planProgramRunFromRequest(
			[
				"Acceptance harness program:",
				"1. Add review blocking coverage.",
				"2. Add Oracle and CI gating coverage.",
				"3. Add sidebar and transcript acceptance coverage.",
			].join("\n"),
			"strict",
		);
		if (program === null) {
			throw new Error("Expected a broad request to create a program run");
		}

		const currentTranche = program.tranches[0];
		if (!currentTranche) {
			throw new Error("Expected a current tranche");
		}

		saveProgramRunToKernel(artifactDir, program);

		const baseState = createInitialState(buildPipelineIdeaForTranche(program, currentTranche), {
			programContext: {
				programId: program.programId,
				trancheId: currentTranche.trancheId,
				trancheTitle: currentTranche.title,
				trancheIndex: currentTranche.sequence,
				trancheCount: program.tranches.length,
				selectionRationale: currentTranche.selectionRationale,
				originatingRequest: program.originatingRequest,
				mode: program.mode,
			},
		});

		await saveState(
			{
				...baseState,
				currentPhase: "BUILD",
				phases: baseState.phases.map((phase) =>
					["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(phase.name)
						? { ...phase, status: "DONE" as const }
						: phase.name === "BUILD"
							? { ...phase, status: "IN_PROGRESS" as const }
							: phase,
				),
				tasks: [
					{
						id: 1,
						title: "Persist structured acceptance state",
						status: "DONE",
						wave: 1,
						depends_on: [],
						attempt: 0,
						strike: 0,
					},
					{
						id: 2,
						title: "Project live sidebar progress",
						status: "IN_PROGRESS",
						wave: 2,
						depends_on: [1],
						attempt: 0,
						strike: 0,
					},
				],
				buildProgress: {
					...baseState.buildProgress,
					currentTask: 2,
					currentTasks: [2],
					currentWave: 2,
					reviewPending: true,
					oraclePending: true,
				},
				reviewStatus: reviewStatusSchema.parse({
					reviewRunId: "review_pr8_sidebar",
					status: "RUNNING",
					verdict: "PENDING",
					selectedReviewers: ["logic-auditor", "security-auditor"],
					requiredReviewers: ["logic-auditor", "security-auditor"],
					reviewers: [
						{ reviewer: "logic-auditor", required: true, status: "COMPLETED", findingsCount: 0 },
						{ reviewer: "security-auditor", required: true, status: "RUNNING", findingsCount: 0 },
					],
					summary: "Structured review is running.",
				}),
				branchLifecycle: {
					...initBranchLifecycle({
						runId: baseState.runId,
						baseBranch: "main",
						description: baseState.idea,
						programId: program.programId,
						trancheId: currentTranche.trancheId,
						humanTitle: currentTranche.title,
					}),
					tasksPushed: ["1"],
					prNumber: 27,
					prUrl: "https://github.com/example/repo/pull/27",
				},
				verificationStatus: {
					status: "PENDING",
					summary: "Delivery is waiting on outstanding verification or CI checks.",
					localStatus: "PASSED",
					localSummary: "Verification PASSED: 2 PASSED.",
					ciStatus: "PENDING",
					ciSummary: "Required GitHub checks are still pending: ci.",
					updatedAt: new Date().toISOString(),
				},
			},
			artifactDir,
		);

		await writeFile(
			join(artifactDir, "orchestration.jsonl"),
			'{"summary":"Tranche 99 started — WRONG"}\nReasoning: leaked details\n',
			"utf-8",
		);

		const sidebar = loadSidebarStateForProject(projectRoot);
		expect(sidebar).not.toBeNull();
		if (sidebar === null) {
			throw new Error("Expected sidebar state to load from structured state");
		}

		const rendered = renderSidebarText(sidebar);
		expect(rendered).toContain("Autopilot plan");
		expect(rendered).toContain("Current tranche: #1");
		expect(rendered).toContain("Phase: BUILD");
		expect(rendered).toContain("Review: RUNNING");
		expect(rendered).toContain("Oracle: PENDING");
		expect(rendered).toContain("CI: PENDING");
		expect(rendered).toContain("Remaining tranches:");
		expect(rendered).not.toContain("Tranche 99 started — WRONG");
		expect(rendered).not.toContain("Reasoning: leaked details");
	});
});
