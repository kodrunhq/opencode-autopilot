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
import {
	createSidebarTuiPlugin,
	loadSidebarStateForProject,
	renderSidebarText,
} from "../../src/ux/sidebar";

let projectRoot: string;
let artifactDir: string;

beforeEach(async () => {
	projectRoot = await mkdtemp(join(tmpdir(), "sidebar-project-"));
	artifactDir = getProjectArtifactDir(projectRoot);
	await mkdir(artifactDir, { recursive: true });
	await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "sidebar-test" }));
});

afterEach(async () => {
	await rm(projectRoot, { recursive: true, force: true });
});

function createProgramFixture() {
	const program = planProgramRunFromRequest(
		[
			"Implement the remediation program:",
			"1. Add program persistence.",
			"2. Add live sidebar projection.",
			"3. Continue automatically across tranches.",
		].join("\n"),
		"strict",
	);

	if (program === null) {
		throw new Error("Expected a multi-tranche program fixture");
	}

	const currentTranche = program.tranches[0];
	if (!currentTranche) {
		throw new Error("Expected a current tranche");
	}

	return { program, currentTranche };
}

describe("sidebar state projection", () => {
	test("shows the program plan from the beginning of the run", async () => {
		const { program, currentTranche } = createProgramFixture();
		saveProgramRunToKernel(artifactDir, program);

		const state = createInitialState(buildPipelineIdeaForTranche(program, currentTranche), {
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

		await saveState(state, artifactDir);

		const sidebar = loadSidebarStateForProject(projectRoot);
		expect(sidebar).not.toBeNull();
		if (sidebar === null) {
			throw new Error("Expected sidebar projection");
		}
		expect(sidebar?.programObjective).toBe(program.originatingRequest);
		expect(sidebar?.phase).toBe("RECON");
		expect(sidebar?.currentTranche?.title).toBe(currentTranche.title);
		expect(sidebar?.tranches.map((tranche) => tranche.status)).toEqual(
			program.tranches.map((tranche) => tranche.status),
		);
		expect(sidebar?.remainingBacklog.tranches).toHaveLength(program.tranches.length - 1);

		const rendered = renderSidebarText(sidebar);
		expect(rendered).toContain("Autopilot plan");
		expect(rendered).toContain("Objective:");
		expect(rendered).toContain("Current tranche:");
		expect(rendered).toContain("Tranches:");
	});

	test("maps live build, review, oracle, and backlog state without transcript scraping", async () => {
		const { program, currentTranche } = createProgramFixture();
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
						title: "Persist program state",
						status: "DONE" as const,
						wave: 1,
						depends_on: [],
						attempt: 0,
						strike: 0,
					},
					{
						id: 2,
						title: "Project live sidebar state",
						status: "IN_PROGRESS" as const,
						wave: 2,
						depends_on: [1],
						attempt: 0,
						strike: 0,
					},
					{
						id: 3,
						title: "Render remaining backlog",
						status: "BLOCKED" as const,
						wave: 2,
						depends_on: [2],
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
					reviewRunId: "review_123",
					status: "RUNNING",
					verdict: "PENDING",
					reviewers: [
						{ reviewer: "logic-auditor", required: true, status: "COMPLETED" },
						{ reviewer: "security-auditor", required: true, status: "RUNNING" },
					],
					summary: "Structured review is running.",
				}),
			},
			artifactDir,
		);

		const sidebar = loadSidebarStateForProject(projectRoot);
		expect(sidebar).not.toBeNull();
		if (sidebar === null) {
			throw new Error("Expected sidebar projection");
		}
		expect(sidebar?.phase).toBe("BUILD");
		expect(sidebar?.currentWave).toBe(2);
		expect(sidebar?.activeTasks.map((task) => task.id)).toEqual([2]);
		expect(sidebar?.reviewStatus.status).toBe("RUNNING");
		expect(sidebar?.reviewStatus.completedReviewers).toBe(1);
		expect(sidebar?.oracleStatus.status).toBe("PENDING");
		expect(sidebar?.blockedReason).toContain("Task 3: Render remaining backlog");
		expect(sidebar?.remainingBacklog.tasks.map((task) => task.id)).toEqual([2, 3]);

		const rendered = renderSidebarText(sidebar);
		expect(rendered).toContain("Review: RUNNING · 1/2 reviewers");
		expect(rendered).toContain("Oracle: PENDING");
		expect(rendered).toContain("Blocked: Task 3: Render remaining backlog");
		expect(rendered).toContain("Remaining tasks:");
	});

	test("slot renderer reads structured state live from disk for ship and CI status", async () => {
		const { program, currentTranche } = createProgramFixture();
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

		await saveState(baseState, artifactDir);

		const registered: Array<{
			order?: number;
			slots: {
				sidebar_content?: (_ctx: unknown, props: { session_id: string }) => unknown;
			};
		}> = [];
		const tui = createSidebarTuiPlugin();
		await tui({
			state: { path: { worktree: projectRoot, directory: projectRoot } },
			slots: {
				register(plugin) {
					registered.push(plugin);
					return "sidebar-slot";
				},
			},
		});

		expect(registered).toHaveLength(1);
		expect(registered[0]?.order).toBe(50);

		const firstRender = String(
			registered[0]?.slots.sidebar_content?.({}, { session_id: "session_1" }) ?? "",
		);
		expect(firstRender).toContain("Phase: RECON");
		expect(firstRender).toContain("Ship: NOT_STARTED");

		await saveState(
			{
				...baseState,
				currentPhase: "SHIP",
				phases: baseState.phases.map((phase) =>
					phase.name === "SHIP"
						? { ...phase, status: "IN_PROGRESS" as const }
						: phase.phaseNumber < 7
							? { ...phase, status: "DONE" as const }
							: phase,
				),
				branchLifecycle: {
					...initBranchLifecycle({
						runId: baseState.runId,
						baseBranch: "main",
						description: baseState.idea,
						programId: program.programId,
						trancheId: currentTranche.trancheId,
						humanTitle: currentTranche.title,
					}),
					tasksPushed: ["1", "2"],
					prNumber: 27,
					prUrl: "https://github.com/example/repo/pull/27",
				},
				oracleSignoffs: {
					tranche: {
						signoffId: "tranche_1",
						scope: "TRANCHE",
						inputsDigest: "digest-1",
						verdict: "PASS",
						reasoning: "Oracle approved the tranche.",
						blockingConditions: [],
					},
					program: null,
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

		const secondRender = String(
			registered[0]?.slots.sidebar_content?.({}, { session_id: "session_1" }) ?? "",
		);
		expect(secondRender).toContain("Phase: SHIP");
		expect(secondRender).toContain("Ship: WAITING_FOR_CI");
		expect(secondRender).toContain("PR: 27");
		expect(secondRender).toContain("CI: PENDING");
	});
});
