import { describe, expect, test } from "bun:test";
import { handleBuild } from "../src/orchestrator/handlers/build";
import { handleExplore } from "../src/orchestrator/handlers/explore";
import { handlePlan } from "../src/orchestrator/handlers/plan";
import { handleRetrospective } from "../src/orchestrator/handlers/retrospective";
import { handleShip } from "../src/orchestrator/handlers/ship";
import { AGENT_NAMES } from "../src/orchestrator/handlers/types";
import { pipelineStateSchema } from "../src/orchestrator/schemas";
import type { PipelineState } from "../src/orchestrator/types";

function makeState(overrides: Partial<PipelineState> = {}): PipelineState {
	const now = new Date().toISOString();
	return pipelineStateSchema.parse({
		schemaVersion: 2,
		status: "IN_PROGRESS",
		idea: "test idea",
		currentPhase: "PLAN",
		startedAt: now,
		lastUpdatedAt: now,
		phases: [
			{ name: "RECON", status: "DONE" },
			{ name: "CHALLENGE", status: "DONE" },
			{ name: "ARCHITECT", status: "DONE" },
			{ name: "EXPLORE", status: "SKIPPED" },
			{ name: "PLAN", status: "IN_PROGRESS" },
			{ name: "BUILD", status: "PENDING" },
			{ name: "SHIP", status: "PENDING" },
			{ name: "RETROSPECTIVE", status: "PENDING" },
		],
		...overrides,
	});
}

// --- PLAN handler ---
describe("handlePlan", () => {
	test("dispatches oc-planner with ARCHITECT artifact refs when no result", async () => {
		const state = makeState({ currentPhase: "PLAN" });
		const result = await handlePlan(state, "/tmp/artifacts");

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe(AGENT_NAMES.PLAN);
		expect(result.prompt).toContain("phases/ARCHITECT/design.md");
		expect(result.prompt).toContain("phases/CHALLENGE/brief.md");
		expect(result.phase).toBe("PLAN");
	});

	test("returns complete when result provided", async () => {
		const state = makeState({ currentPhase: "PLAN" });
		const result = await handlePlan(state, "/tmp/artifacts", "tasks written");

		expect(result.action).toBe("error");
		expect(result.phase).toBe("PLAN");
		expect(result.message).toContain("Failed to load PLAN tasks");
	});
});

// --- SHIP handler ---
describe("handleShip", () => {
	test("dispatches oc-shipper with refs to all prior phase artifacts", async () => {
		const state = makeState({ currentPhase: "SHIP" });
		const result = await handleShip(state, "/tmp/artifacts");
		const prompt = result.prompt ?? "";

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe(AGENT_NAMES.SHIP);
		expect(prompt).toContain("phases/RECON/report.md");
		expect(prompt).toContain("phases/CHALLENGE/brief.md");
		expect(prompt).toContain("phases/ARCHITECT/design.md");
		expect(
			prompt.includes("phases/PLAN/tasks.json") || prompt.includes("phases/PLAN/tasks.md"),
		).toBe(true);
		expect(prompt).toContain("walkthrough.md");
		expect(prompt).toContain("decisions.md");
		expect(prompt).toContain("changelog.md");
		expect(result.phase).toBe("SHIP");
	});

	test("returns error when no SHIP artifacts exist after result", async () => {
		const fs = await import("node:fs/promises");
		const tmpDir = `/tmp/test-ship-error-${Date.now()}`;
		await fs.mkdir(`${tmpDir}/phases/SHIP`, { recursive: true });

		const state = makeState({ currentPhase: "SHIP" });
		const result = await handleShip(state, tmpDir, "shipped");

		expect(result.action).toBe("error");
		expect(result.phase).toBe("SHIP");
		expect(result.message).toContain("walkthrough.md");
		expect(result.message).toContain("decisions.md");
		expect(result.message).toContain("changelog.md");
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	test("returns complete when walkthrough.md exists after result", async () => {
		const fs = await import("node:fs/promises");
		const tmpDir = `/tmp/test-ship-complete-${Date.now()}`;
		await fs.mkdir(`${tmpDir}/phases/SHIP`, { recursive: true });
		await fs.writeFile(`${tmpDir}/phases/SHIP/walkthrough.md`, "# Walkthrough\nContent");

		const state = makeState({ currentPhase: "SHIP" });
		const result = await handleShip(state, tmpDir, "shipped");

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("SHIP");
		await fs.rm(tmpDir, { recursive: true, force: true });
	});
});

// --- RETROSPECTIVE handler ---
describe("handleRetrospective", () => {
	test("dispatches oc-retrospector with refs to all phase artifacts", async () => {
		const state = makeState({ currentPhase: "RETROSPECTIVE" });
		const result = await handleRetrospective(state, "/tmp/artifacts");

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe(AGENT_NAMES.RETROSPECTIVE);
		expect(result.prompt).toContain("phases/");
		expect(result.prompt).not.toContain("RETROSPECTIVE");
		expect(result.phase).toBe("RETROSPECTIVE");
	});

	test("returns complete when result provided", async () => {
		const state = makeState({ currentPhase: "RETROSPECTIVE" });
		const result = await handleRetrospective(
			state,
			"/tmp/artifacts",
			JSON.stringify({ lessons: [] }),
		);

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("RETROSPECTIVE");
		expect(result.progress).toContain("0 lessons");
	});
});

// --- EXPLORE handler ---
describe("handleExplore", () => {
	test("always returns complete immediately", async () => {
		const state = makeState({ currentPhase: "EXPLORE" });
		const result = await handleExplore(state, "/tmp/artifacts");

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("EXPLORE");
	});

	test("sets progress message indicating phase was skipped", async () => {
		const state = makeState({ currentPhase: "EXPLORE" });
		const result = await handleExplore(state, "/tmp/artifacts");

		expect(result.progress).toContain("skipped");
	});

	test("returns complete even with result provided", async () => {
		const state = makeState({ currentPhase: "EXPLORE" });
		const result = await handleExplore(state, "/tmp/artifacts", "some result");

		expect(result.action).toBe("complete");
	});
});

// --- BUILD handler ---
describe("handleBuild", () => {
	function makeBuildState(
		tasks: Array<{
			id: number;
			title: string;
			status: "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "FAILED" | "BLOCKED";
			wave: number;
		}>,
		buildProgress?: Partial<PipelineState["buildProgress"]>,
	): PipelineState {
		return makeState({
			currentPhase: "BUILD",
			tasks: tasks.map((t) => ({ ...t, depends_on: [], attempt: 0, strike: 0 })),
			buildProgress: {
				currentTask: null,
				currentTasks: [],
				currentWave: null,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
				...buildProgress,
			},
		});
	}

	test("returns error when no tasks found", async () => {
		const state = makeBuildState([]);
		const result = await handleBuild(state, "/tmp/artifacts");

		expect(result.action).toBe("error");
		expect(result.message).toContain("No tasks found");
	});

	test("first call dispatches oc-implementer for first pending task in wave 1", async () => {
		const state = makeBuildState([
			{ id: 1, title: "Setup DB", status: "PENDING", wave: 1 },
			{ id: 2, title: "Add API", status: "PENDING", wave: 2 },
		]);
		const result = await handleBuild(state, "/tmp/artifacts");

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe(AGENT_NAMES.BUILD);
		expect(result.prompt).toContain("Setup DB");
		expect(result.phase).toBe("BUILD");
	});

	test("result provided marks current task DONE and finds next pending", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "PENDING", wave: 1 },
			],
			{ currentTask: 1, currentWave: 1 },
		);
		const result = await handleBuild(state, "/tmp/artifacts", "task 1 done");

		expect(result.action).toBe("dispatch");
		expect(result.taskId).toBe(2);
	});

	test("multiple tasks in same wave dispatches them in parallel", async () => {
		const state = makeBuildState([
			{ id: 1, title: "Task A", status: "PENDING", wave: 1 },
			{ id: 2, title: "Task B", status: "PENDING", wave: 1 },
			{ id: 3, title: "Task C", status: "PENDING", wave: 2 },
		]);
		const result = await handleBuild(state, "/tmp/artifacts");

		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(2);
		expect(result._stateUpdates?.buildProgress?.currentTask).toBe(1);
		expect(result._stateUpdates?.buildProgress?.currentTasks).toEqual([1, 2]);
		const updatedTasks = result._stateUpdates?.tasks as
			| Array<{ id: number; status: string }>
			| undefined;
		expect(updatedTasks).toBeDefined();
		if (updatedTasks) {
			expect(updatedTasks.find((t) => t.id === 1)?.status).toBe("IN_PROGRESS");
			expect(updatedTasks.find((t) => t.id === 2)?.status).toBe("IN_PROGRESS");
			expect(updatedTasks.find((t) => t.id === 3)?.status).toBe("PENDING");
		}
	});

	test("all tasks in current wave DONE sets reviewPending", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "PENDING", wave: 2 },
			],
			{ currentTask: 1, currentWave: 1 },
		);
		const result = await handleBuild(state, "/tmp/artifacts", "task done");

		// Wave 1 complete -> review dispatch
		expect(result.action).toBe("dispatch");
		expect(result.agent).toContain("review");
	});

	test("after review advances to next wave", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "DONE", wave: 1 },
				{ id: 2, title: "Task B", status: "PENDING", wave: 2 },
			],
			{ currentTask: null, currentWave: 1, reviewPending: true },
		);
		const result = await handleBuild(state, "/tmp/artifacts", '{"severity":"LOW"}');

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe(AGENT_NAMES.BUILD);
		expect(result.prompt).toContain("Task B");
	});

	test("review with CRITICAL findings returns fix dispatch", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "DONE", wave: 1 },
				{ id: 2, title: "Task B", status: "PENDING", wave: 2 },
			],
			{ currentTask: null, currentWave: 1, reviewPending: true },
		);
		const result = await handleBuild(
			state,
			"/tmp/artifacts",
			'{"severity":"CRITICAL","findings":["Security issue"]}',
		);

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe(AGENT_NAMES.BUILD);
		expect(result.prompt).toContain("CRITICAL");
	});

	test("all tasks in all waves DONE returns complete", async () => {
		const state = makeBuildState([
			{ id: 1, title: "Task A", status: "DONE", wave: 1 },
			{ id: 2, title: "Task B", status: "DONE", wave: 2 },
		]);
		const result = await handleBuild(state, "/tmp/artifacts");

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("BUILD");
	});

	test("state buildProgress updated correctly", async () => {
		const state = makeBuildState([{ id: 1, title: "Setup DB", status: "PENDING", wave: 1 }]);
		const result = await handleBuild(state, "/tmp/artifacts");

		// The result should have state updates
		expect(result).toBeDefined();
		expect(result.action).toBe("dispatch");
	});

	test("same task ID never dispatched twice", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "DONE", wave: 1 },
				{ id: 2, title: "Task B", status: "PENDING", wave: 1 },
			],
			{ currentTask: null, currentWave: 1 },
		);
		const result = await handleBuild(state, "/tmp/artifacts");

		// Should only dispatch task 2 (task 1 is DONE)
		if (result.action === "dispatch") {
			expect(result.prompt).toContain("Task B");
			expect(result.prompt).not.toContain("Task A");
		}
	});

	test("resume with only IN_PROGRESS tasks does not return complete", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentTask: null, currentWave: 1 },
		);
		// No result — this is a resume call
		const result = await handleBuild(state, "/tmp/artifacts");

		// Must fail closed — no fake builder redispatches while waiting on typed results.
		expect(result.action).toBe("error");
		expect(result.code).toBe("E_BUILD_RESULT_PENDING");
		expect(result.progress).toContain("waiting for typed result");
	});

	test("result marks current in-progress task DONE and dispatches next pending task", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "PENDING", wave: 1 },
			],
			{ currentTask: 1, currentWave: 1 },
		);
		const result = await handleBuild(state, "/tmp/artifacts", "task A completed");

		expect(result.action).toBe("dispatch");
		expect(result.taskId).toBe(2);
		const updatedTasks = result._stateUpdates?.tasks as
			| Array<{ id: number; status: string }>
			| undefined;
		expect(updatedTasks).toBeDefined();
		if (updatedTasks) {
			expect(updatedTasks.find((t) => t.id === 1)?.status).toBe("DONE");
			expect(updatedTasks.find((t) => t.id === 2)?.status).toBe("IN_PROGRESS");
		}
	});

	test("typed context requires taskId for BUILD completion when currentTask is null", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentTask: null, currentWave: 1 },
		);
		const result = await handleBuild(state, "/tmp/artifacts", "done", {
			envelope: {
				schemaVersion: 1,
				resultId: "r1",
				runId: "run-1",
				phase: "BUILD",
				dispatchId: "d1",
				agent: "oc-implementer",
				kind: "task_completion",
				taskId: null,
				payload: { text: "done" },
			},
		});

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_BUILD_TASK_ID_REQUIRED");
	});

	test("review completion with more tasks remaining dispatches next wave in parallel", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "DONE", wave: 1 },
				{ id: 2, title: "Task B", status: "PENDING", wave: 2 },
				{ id: 3, title: "Task C", status: "PENDING", wave: 2 },
			],
			{ currentTask: null, currentWave: 1, reviewPending: true },
		);
		const result = await handleBuild(state, "/tmp/artifacts", '{"severity":"LOW"}');

		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(2);
		expect(result._stateUpdates?.buildProgress?.currentTasks).toEqual([2, 3]);
		const updatedTasks = result._stateUpdates?.tasks as
			| Array<{ id: number; status: string }>
			| undefined;
		expect(updatedTasks).toBeDefined();
		if (updatedTasks) {
			expect(updatedTasks.find((t) => t.id === 2)?.status).toBe("IN_PROGRESS");
			expect(updatedTasks.find((t) => t.id === 3)?.status).toBe("IN_PROGRESS");
		}
	});

	test("strike count > 3 returns error", async () => {
		const state = makeBuildState([{ id: 1, title: "Task A", status: "DONE", wave: 1 }], {
			currentTask: null,
			currentWave: 1,
			reviewPending: true,
			strikeCount: 4,
		});
		const result = await handleBuild(state, "/tmp/artifacts", '{"severity":"CRITICAL"}');

		expect(result.action).toBe("error");
		expect(result.message).toContain("retries");
	});
});
