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

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("PLAN");
	});
});

// --- SHIP handler ---
describe("handleShip", () => {
	test("dispatches oc-shipper with refs to all prior phase artifacts", async () => {
		const state = makeState({ currentPhase: "SHIP" });
		const result = await handleShip(state, "/tmp/artifacts");

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe(AGENT_NAMES.SHIP);
		expect(result.prompt).toContain("phases/RECON/report.md");
		expect(result.prompt).toContain("phases/CHALLENGE/brief.md");
		expect(result.prompt).toContain("phases/ARCHITECT/design.md");
		expect(result.prompt).toContain("phases/PLAN/tasks.md");
		expect(result.prompt).toContain("walkthrough.md");
		expect(result.prompt).toContain("decisions.md");
		expect(result.prompt).toContain("changelog.md");
		expect(result.phase).toBe("SHIP");
	});

	test("returns complete when result provided", async () => {
		const state = makeState({ currentPhase: "SHIP" });
		const result = await handleShip(state, "/tmp/artifacts", "shipped");

		expect(result.action).toBe("complete");
		expect(result.phase).toBe("SHIP");
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
		expect(result.prompt).toContain("lessons.json");
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
		tasks: Array<{ id: number; title: string; status: string; wave: number }>,
		buildProgress?: Partial<PipelineState["buildProgress"]>,
	): PipelineState {
		return makeState({
			currentPhase: "BUILD",
			tasks: tasks.map((t) => ({ ...t, attempt: 0, strike: 0 })),
			buildProgress: {
				currentTask: null,
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

		// Should dispatch next task or indicate review
		expect(["dispatch", "dispatch_multi"]).toContain(result.action);
	});

	test("multiple tasks in same wave returns dispatch_multi with tasks marked IN_PROGRESS", async () => {
		const state = makeBuildState([
			{ id: 1, title: "Task A", status: "PENDING", wave: 1 },
			{ id: 2, title: "Task B", status: "PENDING", wave: 1 },
			{ id: 3, title: "Task C", status: "PENDING", wave: 2 },
		]);
		const result = await handleBuild(state, "/tmp/artifacts");

		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toBeDefined();
		expect(result.agents?.length).toBe(2);
		// dispatch_multi should set currentTask to null (results come back individually)
		expect(result._stateUpdates?.buildProgress?.currentTask).toBeNull();
		// dispatch_multi should mark dispatched tasks as IN_PROGRESS
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

		// Must NOT return complete — work is still in progress
		expect(result.action).not.toBe("complete");
		expect(result.action).toBe("dispatch");
		expect(result.progress).toContain("in-progress");
	});

	test("dispatch_multi result marks first IN_PROGRESS task DONE", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentTask: null, currentWave: 1 },
		);
		const result = await handleBuild(state, "/tmp/artifacts", "task A completed");

		// Should mark first IN_PROGRESS task (id:1) as DONE, dispatch next or wave complete
		expect(["dispatch", "dispatch_multi"]).toContain(result.action);
		const updatedTasks = result._stateUpdates?.tasks as
			| Array<{ id: number; status: string }>
			| undefined;
		expect(updatedTasks).toBeDefined();
		if (updatedTasks) {
			expect(updatedTasks.find((t) => t.id === 1)?.status).toBe("DONE");
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
