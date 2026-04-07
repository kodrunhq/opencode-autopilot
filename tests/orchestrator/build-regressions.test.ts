import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import type { Phase } from "../../src/orchestrator/types";
import { orchestrateCore } from "../../src/tools/orchestrate";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "build-regression-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("BUILD regressions", () => {
	test("raw BUILD result is rejected instead of using legacy attribution fallback", async () => {
		const state = createInitialState("gloomberg regression test");
		const buildState = {
			...state,
			currentPhase: "BUILD" as Phase,
			tasks: [
				{
					id: 1,
					title: "Task A",
					status: "IN_PROGRESS" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
			],
			buildProgress: {
				currentTask: 1,
				currentTasks: [1],
				currentWave: 1,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			pendingDispatches: [
				{
					dispatchId: "dispatch_build_1",
					phase: "BUILD" as const,
					agent: "oc-implementer",
					issuedAt: new Date().toISOString(),
					resultKind: "task_completion" as const,
					taskId: 1,
				},
			],
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "BUILD"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(buildState, tempDir);

		const result = JSON.parse(await orchestrateCore({ result: "task finished" }, tempDir));
		expect(result.action).toBe("error");
		expect(result.code).toBe("E_INVALID_RESULT");
		expect(result.message).toContain("typed result envelope");
	});

	test("BUILD emits dispatch_multi for 2+ same-wave pending tasks", async () => {
		const state = createInitialState("parallel build regression");
		const buildState = {
			...state,
			currentPhase: "BUILD" as Phase,
			tasks: [
				{
					id: 1,
					title: "Task A",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
				{
					id: 2,
					title: "Task B",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
			],
			buildProgress: {
				currentTask: null,
				currentTasks: [],
				currentWave: null,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "BUILD"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(buildState, tempDir);

		const result = JSON.parse(await orchestrateCore({}, tempDir));
		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(2);
		expect(result.agents[0].taskId).toBe(1);
		expect(result.agents[1].taskId).toBe(2);
	});

	test("BUILD emits single dispatch for 1 pending task in wave", async () => {
		const state = createInitialState("single task build");
		const buildState = {
			...state,
			currentPhase: "BUILD" as Phase,
			tasks: [
				{
					id: 1,
					title: "Task A",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
			],
			buildProgress: {
				currentTask: null,
				currentTasks: [],
				currentWave: null,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "BUILD"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(buildState, tempDir);

		const result = JSON.parse(await orchestrateCore({}, tempDir));
		expect(result.action).toBe("dispatch");
		expect(result.taskId).toBe(1);
	});

	test("BUILD respects wave boundaries — wave 2 tasks wait for wave 1", async () => {
		const state = createInitialState("wave boundary test");
		const buildState = {
			...state,
			currentPhase: "BUILD" as Phase,
			tasks: [
				{
					id: 1,
					title: "Wave 1 Task",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
				{
					id: 2,
					title: "Wave 2 Task",
					status: "PENDING" as const,
					wave: 2,
					depends_on: [1],
					attempt: 0,
					strike: 0,
				},
			],
			buildProgress: {
				currentTask: null,
				currentTasks: [],
				currentWave: null,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "BUILD"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(buildState, tempDir);

		const result = JSON.parse(await orchestrateCore({}, tempDir));
		expect(result.action).toBe("dispatch");
		expect(result.taskId).toBe(1);
	});

	test("BUILD tracks currentTasks array in state updates for parallel dispatch", async () => {
		const state = createInitialState("currentTasks tracking");
		const buildState = {
			...state,
			currentPhase: "BUILD" as Phase,
			tasks: [
				{
					id: 1,
					title: "Task A",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
				{
					id: 2,
					title: "Task B",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
				{
					id: 3,
					title: "Task C",
					status: "PENDING" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
			],
			buildProgress: {
				currentTask: null,
				currentTasks: [],
				currentWave: null,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			phases: state.phases.map((p) =>
				["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(p.name)
					? { ...p, status: "DONE" as const }
					: p.name === "BUILD"
						? { ...p, status: "IN_PROGRESS" as const }
						: p,
			),
		};
		await saveState(buildState, tempDir);

		const result = JSON.parse(await orchestrateCore({}, tempDir));
		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(3);
	});
});
