import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleBuild } from "../../src/orchestrator/handlers/build";
import { buildParallelDispatch } from "../../src/orchestrator/handlers/build-utils";
import { pipelineStateSchema } from "../../src/orchestrator/schemas";
import { saveState, updatePersistedState } from "../../src/orchestrator/state";
import type { PipelineState } from "../../src/orchestrator/types";
import { computeLineHash, hashlineEditCore } from "../../src/tools/hashline-edit";
import {
	buildMergeTransform,
	extractDispatchTaskIds,
	isStaleDispatch,
	prepareStateForBuildRerun,
} from "../../src/tools/orchestrate";

function makeBuildState(
	tasks: Array<{
		id: number;
		title: string;
		status: "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "FAILED" | "BLOCKED";
		wave: number;
	}>,
	buildProgress?: Partial<PipelineState["buildProgress"]>,
): PipelineState {
	const now = new Date().toISOString();
	return pipelineStateSchema.parse({
		schemaVersion: 2,
		status: "IN_PROGRESS",
		idea: "parallel build integration test",
		currentPhase: "BUILD",
		startedAt: now,
		lastUpdatedAt: now,
		phases: [
			{ name: "RECON", status: "DONE" },
			{ name: "CHALLENGE", status: "DONE" },
			{ name: "ARCHITECT", status: "DONE" },
			{ name: "EXPLORE", status: "SKIPPED" },
			{ name: "PLAN", status: "DONE" },
			{ name: "BUILD", status: "IN_PROGRESS" },
			{ name: "SHIP", status: "PENDING" },
			{ name: "RETROSPECTIVE", status: "PENDING" },
		],
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

describe("parallel BUILD integration", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "parallel-build-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("maxParallelTasks=1 forces sequential dispatch", async () => {
		const tasks = [1, 2, 3].map((id) => ({
			id,
			title: `Task ${id}`,
			status: "PENDING" as const,
			wave: 1,
			depends_on: [],
			attempt: 0,
			strike: 0,
		}));
		const result = await buildParallelDispatch(
			tasks,
			1,
			tasks,
			{
				currentTask: null,
				currentTasks: [],
				currentWave: null,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			tempDir,
			"run-1",
			1,
		);

		expect(result.action).toBe("dispatch");
		expect(result.taskId).toBe(1);
		expect(result.prompt).toContain("[EXECUTION MODE: SOLO]");
		expect(result._stateUpdates?.buildProgress?.currentTasks).toEqual([1]);
		expect(
			result._stateUpdates?.tasks?.filter((task) => task.status === "IN_PROGRESS"),
		).toHaveLength(1);
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 1)?.status).toBe("IN_PROGRESS");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 2)?.status).toBe("PENDING");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 3)?.status).toBe("PENDING");
	});

	test("cap-respected batching: 8 tasks, only 5 dispatched", async () => {
		const tasks = Array.from({ length: 8 }, (_, index) => ({
			id: index + 1,
			title: `Task ${index + 1}`,
			status: "PENDING" as const,
			wave: 1,
			depends_on: [],
			attempt: 0,
			strike: 0,
		}));
		const result = await buildParallelDispatch(
			tasks,
			1,
			tasks,
			{
				currentTask: null,
				currentTasks: [],
				currentWave: null,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			tempDir,
			"run-1",
			5,
		);

		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(5);
		expect(result.agents?.map((agent) => agent.taskId)).toEqual([1, 2, 3, 4, 5]);
		expect(result.agents?.[0].prompt).toContain("[EXECUTION MODE: PARALLEL]");
		expect(result._stateUpdates?.buildProgress?.currentTasks).toEqual([1, 2, 3, 4, 5]);
		expect(
			result._stateUpdates?.tasks?.filter((task) => task.status === "IN_PROGRESS"),
		).toHaveLength(5);
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 6)?.status).toBe("PENDING");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 8)?.status).toBe("PENDING");
	});

	test("out-of-order sibling completions", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
				{ id: 3, title: "Task C", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentTask: null, currentTasks: [1, 2, 3], currentWave: 1 },
		);
		const result = await handleBuild(state, tempDir, "task 2 done", {
			envelope: {
				schemaVersion: 1,
				resultId: "r1",
				runId: "run-1",
				phase: "BUILD",
				dispatchId: "d1",
				agent: "oc-implementer",
				kind: "task_completion",
				taskId: 2,
				payload: { text: "task 2 done" },
			},
		});

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_BUILD_RESULT_PENDING");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 2)?.status).toBe("DONE");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 1)?.status).toBe("IN_PROGRESS");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 3)?.status).toBe("IN_PROGRESS");
		expect(result._stateUpdates?.buildProgress?.currentTasks).toEqual([1, 3]);
	});

	test("sibling failure mid-wave", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
				{ id: 3, title: "Task C", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentTask: null, currentTasks: [1, 2, 3], currentWave: 1 },
		);
		const result = await handleBuild(state, tempDir, undefined, {
			envelope: {
				schemaVersion: 1,
				resultId: "r1",
				runId: "run-1",
				phase: "BUILD",
				dispatchId: "d1",
				agent: "oc-implementer",
				kind: "task_completion",
				taskId: 1,
				payload: {
					text: 'DISPATCH_FAILED: Agent "oc-implementer" failed in phase BUILD.\nError category: timeout\nAttempts: 3',
				},
			},
		});

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_BUILD_RESULT_PENDING");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 1)?.status).toBe("FAILED");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 2)?.status).toBe("IN_PROGRESS");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 3)?.status).toBe("IN_PROGRESS");
		expect(result._stateUpdates?.buildProgress?.currentTasks).toEqual([2, 3]);
	});

	test("concurrent same-file hash-edit contention", async () => {
		const filePath = join(tempDir, "content.txt");
		await writeFile(filePath, "alpha\nbeta\ngamma\ndelta\nepsilon\n", "utf-8");

		const firstLineHash = computeLineHash("beta");
		const secondLineHash = computeLineHash("delta");

		const [firstResult, secondResult] = await Promise.all([
			hashlineEditCore({
				file: filePath,
				edits: [{ op: "replace", pos: `2#${firstLineHash}`, lines: "beta updated" }],
			}),
			hashlineEditCore({
				file: filePath,
				edits: [{ op: "replace", pos: `4#${secondLineHash}`, lines: "delta updated" }],
			}),
		]);

		expect(firstResult).toContain("Applied 1 edit(s)");
		expect(secondResult).toContain("Applied 1 edit(s)");
		expect(await readFile(filePath, "utf-8")).toBe(
			"alpha\nbeta updated\ngamma\ndelta updated\nepsilon\n",
		);
	});

	test("replenishment respects maxParallel cap with in-progress siblings", async () => {
		// 8 tasks, cap 5 → initial dispatch sends 5, leaving 3 pending.
		// Task 1 completes → 4 still in progress, 3 pending.
		// Replenishment should dispatch only 1 (5 - 4 = 1 remaining slot),
		// NOT 3 (which would exceed the cap).
		const allTasks = Array.from({ length: 8 }, (_, index) => ({
			id: index + 1,
			title: `Task ${index + 1}`,
			status: (index < 5 ? "IN_PROGRESS" : "PENDING") as "IN_PROGRESS" | "PENDING",
			wave: 1,
			depends_on: [] as number[],
			attempt: 0,
			strike: 0,
		}));

		const state = makeBuildState(allTasks, {
			currentTask: 1,
			currentTasks: [1, 2, 3, 4, 5],
			currentWave: 1,
		});

		// Task 1 completes successfully
		const result = await handleBuild(state, tempDir, undefined, {
			envelope: {
				schemaVersion: 1,
				resultId: "r-replenish",
				runId: "run-1",
				phase: "BUILD",
				dispatchId: "d-replenish",
				agent: "oc-implementer",
				kind: "task_completion",
				taskId: 1,
				payload: { text: "task 1 done" },
			},
		});

		// Should dispatch exactly 1 task (task 6) to fill the slot freed by task 1
		expect(result.action).toBe("dispatch");
		expect(result.taskId).toBe(6);
		expect(result.prompt).toContain("[EXECUTION MODE: PARALLEL]");

		const updatedTasks = result._stateUpdates?.tasks ?? [];
		const inProgressCount = updatedTasks.filter((t) => t.status === "IN_PROGRESS").length;
		// 4 original (2-5) + 1 newly dispatched (6) = 5, never exceeds maxParallel
		expect(inProgressCount).toBe(5);
		expect(updatedTasks.find((t) => t.id === 1)?.status).toBe("DONE");
		expect(updatedTasks.find((t) => t.id === 6)?.status).toBe("IN_PROGRESS");
		expect(updatedTasks.find((t) => t.id === 7)?.status).toBe("PENDING");
		expect(updatedTasks.find((t) => t.id === 8)?.status).toBe("PENDING");
		expect(result._stateUpdates?.buildProgress?.currentTasks).toEqual([2, 3, 4, 5, 6]);
	});

	test("replenishment dispatches multiple when multiple slots free", async () => {
		// 8 tasks, cap 5 → 3 in-progress (3-5), 3 pending (6-8), 2 done (1-2)
		// 2 slots free → should dispatch exactly 2 tasks
		const allTasks = [
			{
				id: 1,
				title: "Task 1",
				status: "DONE" as const,
				wave: 1,
				depends_on: [] as number[],
				attempt: 0,
				strike: 0,
			},
			{
				id: 2,
				title: "Task 2",
				status: "DONE" as const,
				wave: 1,
				depends_on: [] as number[],
				attempt: 0,
				strike: 0,
			},
			{
				id: 3,
				title: "Task 3",
				status: "IN_PROGRESS" as const,
				wave: 1,
				depends_on: [] as number[],
				attempt: 0,
				strike: 0,
			},
			{
				id: 4,
				title: "Task 4",
				status: "IN_PROGRESS" as const,
				wave: 1,
				depends_on: [] as number[],
				attempt: 0,
				strike: 0,
			},
			{
				id: 5,
				title: "Task 5",
				status: "IN_PROGRESS" as const,
				wave: 1,
				depends_on: [] as number[],
				attempt: 0,
				strike: 0,
			},
			{
				id: 6,
				title: "Task 6",
				status: "PENDING" as const,
				wave: 1,
				depends_on: [] as number[],
				attempt: 0,
				strike: 0,
			},
			{
				id: 7,
				title: "Task 7",
				status: "PENDING" as const,
				wave: 1,
				depends_on: [] as number[],
				attempt: 0,
				strike: 0,
			},
			{
				id: 8,
				title: "Task 8",
				status: "PENDING" as const,
				wave: 1,
				depends_on: [] as number[],
				attempt: 0,
				strike: 0,
			},
		];

		const pendingTasks = allTasks.filter((t) => t.status === "PENDING");
		const result = await buildParallelDispatch(
			pendingTasks,
			1,
			allTasks,
			{
				currentTask: 2,
				currentTasks: [3, 4, 5],
				currentWave: 1,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			tempDir,
			"run-1",
			5,
			3, // 3 in-progress → only 2 slots available
		);

		expect(result.action).toBe("dispatch_multi");
		expect(result.agents).toHaveLength(2);
		expect(result.agents?.map((a) => a.taskId)).toEqual([6, 7]);
	});

	test("no dispatch when currentInProgressCount equals maxParallel", async () => {
		// 8 tasks, cap 5 → 5 in-progress, 3 pending.
		// Cap is already full → buildParallelDispatch should return a pending result,
		// NOT dispatch any new tasks.
		const allTasks = Array.from({ length: 8 }, (_, index) => ({
			id: index + 1,
			title: `Task ${index + 1}`,
			status: (index < 5 ? "IN_PROGRESS" : "PENDING") as "IN_PROGRESS" | "PENDING",
			wave: 1,
			depends_on: [] as number[],
			attempt: 0,
			strike: 0,
		}));

		const pendingTasks = allTasks.filter((t) => t.status === "PENDING");
		const result = await buildParallelDispatch(
			pendingTasks,
			1,
			allTasks,
			{
				currentTask: 1,
				currentTasks: [1, 2, 3, 4, 5],
				currentWave: 1,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			tempDir,
			"run-1",
			5,
			5, // 5 in-progress === maxParallel of 5 → 0 remaining slots
		);

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_BUILD_RESULT_PENDING");
		expect(result._stateUpdates?.buildProgress?.currentTasks).toEqual([1, 2, 3, 4, 5]);
		// No new tasks should be marked IN_PROGRESS
		expect(result._stateUpdates?.tasks?.filter((t) => t.status === "IN_PROGRESS")).toHaveLength(5);
		expect(result._stateUpdates?.tasks?.find((t) => t.id === 6)?.status).toBe("PENDING");
	});

	test("failed task marked FAILED not DONE", async () => {
		const state = makeBuildState([{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 }], {
			currentTask: null,
			currentTasks: [1],
			currentWave: 1,
		});
		const result = await handleBuild(state, tempDir, undefined, {
			envelope: {
				schemaVersion: 1,
				resultId: "r1",
				runId: "run-1",
				phase: "BUILD",
				dispatchId: "d1",
				agent: "oc-implementer",
				kind: "task_completion",
				taskId: 1,
				payload: {
					text: 'DISPATCH_FAILED: Agent "oc-implementer" failed in phase BUILD.\nError category: timeout\nAttempts: 3',
				},
			},
		});

		expect(result.action).toBe("dispatch");
		expect(result.agent).toBe("oc-reviewer");
		expect(result._stateUpdates?.tasks?.find((task) => task.id === 1)?.status).toBe("FAILED");
		expect(result._stateUpdates?.buildProgress?.reviewPending).toBe(true);
	});

	test("concurrent task completions do not overwrite each other", async () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
				{ id: 3, title: "Task C", status: "PENDING", wave: 2 },
			],
			{ currentTask: 1, currentTasks: [1, 2], currentWave: 1 },
		);

		await saveState(state, tempDir);

		const task1Updates: Partial<PipelineState> = {
			tasks: state.tasks.map((t) => (t.id === 1 ? { ...t, status: "DONE" as const } : t)),
			buildProgress: {
				...state.buildProgress,
				currentTasks: [2],
			},
		};

		const task2Updates: Partial<PipelineState> = {
			tasks: state.tasks.map((t) => (t.id === 2 ? { ...t, status: "DONE" as const } : t)),
			buildProgress: {
				...state.buildProgress,
				currentTasks: [1],
			},
		};

		const [result1, result2] = await Promise.all([
			updatePersistedState(tempDir, state, buildMergeTransform(task1Updates, state).transform),
			updatePersistedState(tempDir, state, buildMergeTransform(task2Updates, state).transform),
		]);

		const final = result1.stateRevision > result2.stateRevision ? result1 : result2;
		expect(final.tasks.find((t) => t.id === 1)?.status).toBe("DONE");
		expect(final.tasks.find((t) => t.id === 2)?.status).toBe("DONE");
		expect(final.tasks.find((t) => t.id === 3)?.status).toBe("PENDING");
		expect(final.buildProgress.currentTasks).toEqual([]);
	});

	test("prepareStateForBuildRerun sets reviewPending when wave is complete", () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "DONE", wave: 1 },
				{ id: 2, title: "Task B", status: "DONE", wave: 1 },
				{ id: 3, title: "Task C", status: "PENDING", wave: 2 },
			],
			{ currentWave: 1, currentTasks: [] },
		);

		const prepared = prepareStateForBuildRerun(state);
		expect(prepared.buildProgress.reviewPending).toBe(true);
	});

	test("prepareStateForBuildRerun does not set reviewPending when wave is incomplete", () => {
		const state = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "DONE", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
				{ id: 3, title: "Task C", status: "PENDING", wave: 2 },
			],
			{ currentWave: 1, currentTasks: [2] },
		);

		const prepared = prepareStateForBuildRerun(state);
		expect(prepared.buildProgress.reviewPending).toBe(false);
	});

	test("isStaleDispatch detects duplicate single dispatch", () => {
		// Pre-handler state: task 6 already IN_PROGRESS (dispatched by sibling)
		const preHandlerState = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "DONE", wave: 1 },
				{ id: 6, title: "Task F", status: "IN_PROGRESS", wave: 1 },
				{ id: 7, title: "Task G", status: "PENDING", wave: 1 },
			],
			{ currentWave: 1, currentTasks: [6] },
		);

		const staleResult = {
			action: "dispatch" as const,
			agent: "oc-implementer",
			prompt: "do stuff",
			taskId: 6,
			phase: "BUILD",
		};

		expect(isStaleDispatch(staleResult, preHandlerState)).toBe(true);
	});

	test("isStaleDispatch returns false for fresh dispatch", () => {
		// Pre-handler state: task 7 is PENDING, so dispatching it is fresh
		const preHandlerState = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "DONE", wave: 1 },
				{ id: 6, title: "Task F", status: "IN_PROGRESS", wave: 1 },
				{ id: 7, title: "Task G", status: "PENDING", wave: 1 },
			],
			{ currentWave: 1, currentTasks: [6] },
		);

		const freshResult = {
			action: "dispatch" as const,
			agent: "oc-implementer",
			prompt: "do stuff",
			taskId: 7,
			phase: "BUILD",
		};

		expect(isStaleDispatch(freshResult, preHandlerState)).toBe(false);
	});

	test("isStaleDispatch detects duplicate dispatch_multi", () => {
		// Pre-handler state: tasks 5 and 6 already IN_PROGRESS from sibling
		const preHandlerState = makeBuildState(
			[
				{ id: 5, title: "Task E", status: "IN_PROGRESS", wave: 1 },
				{ id: 6, title: "Task F", status: "IN_PROGRESS", wave: 1 },
				{ id: 7, title: "Task G", status: "PENDING", wave: 1 },
			],
			{ currentWave: 1, currentTasks: [5, 6] },
		);

		const staleMulti = {
			action: "dispatch_multi" as const,
			agents: [
				{ agent: "oc-implementer", prompt: "do 5", taskId: 5 },
				{ agent: "oc-implementer", prompt: "do 6", taskId: 6 },
			],
			phase: "BUILD",
		};

		expect(isStaleDispatch(staleMulti, preHandlerState)).toBe(true);
	});

	test("isStaleDispatch detects sibling duplicate after applyStateUpdates merge", () => {
		// Given: handler A's pre-handler state has task 7 as PENDING
		const preHandlerState = makeBuildState(
			[
				{ id: 5, title: "Task E", status: "IN_PROGRESS", wave: 1 },
				{ id: 6, title: "Task F", status: "DONE", wave: 1 },
				{ id: 7, title: "Task G", status: "PENDING", wave: 1 },
			],
			{ currentWave: 1, currentTasks: [5] },
		);

		// When: sibling B dispatched task 7 first → merged into disk state
		const diskStateAfterSibling = makeBuildState(
			[
				{ id: 5, title: "Task E", status: "IN_PROGRESS", wave: 1 },
				{ id: 6, title: "Task F", status: "DONE", wave: 1 },
				{ id: 7, title: "Task G", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentWave: 1, currentTasks: [5, 7] },
		);

		// Handler A also wants to dispatch task 7 (stale decision)
		const handlerAUpdates = {
			tasks: [
				{
					id: 5,
					title: "Task E",
					status: "IN_PROGRESS" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
				{
					id: 6,
					title: "Task F",
					status: "DONE" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
				{
					id: 7,
					title: "Task G",
					status: "IN_PROGRESS" as const,
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
			],
			buildProgress: {
				currentTask: null,
				currentTasks: [5, 7],
				currentWave: 1,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
		};

		// buildMergeTransform diffs A's updates vs preHandlerState
		// Task 7: pre=PENDING, update=IN_PROGRESS → changed by A
		const { transform, redundantTaskIds } = buildMergeTransform(
			handlerAUpdates as Partial<PipelineState>,
			preHandlerState,
		);
		const mergedState = transform(diskStateAfterSibling);

		// Task 7 is IN_PROGRESS in merged state (from both A and B)
		expect(mergedState.tasks.find((t) => t.id === 7)?.status).toBe("IN_PROGRESS");
		// Task 7 was detected as redundant (disk already had it IN_PROGRESS)
		expect(redundantTaskIds.has(7)).toBe(true);

		const dispatchResult = {
			action: "dispatch" as const,
			agent: "oc-implementer",
			prompt: "implement task 7",
			taskId: 7,
			phase: "BUILD",
		};

		// Then: isStaleDispatch uses preHandlerState where task 7 was PENDING
		// → not stale from A's perspective (A legitimately dispatched it)
		expect(isStaleDispatch(dispatchResult, preHandlerState)).toBe(false);

		// But if sibling B's handler also had task 7 as IN_PROGRESS in its
		// pre-handler state (because A dispatched first), B would see it as stale
		const preHandlerStateForB = makeBuildState(
			[
				{ id: 5, title: "Task E", status: "IN_PROGRESS", wave: 1 },
				{ id: 6, title: "Task F", status: "DONE", wave: 1 },
				{ id: 7, title: "Task G", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentWave: 1, currentTasks: [5, 7] },
		);
		expect(isStaleDispatch(dispatchResult, preHandlerStateForB)).toBe(true);
	});

	test("isStaleDispatch detects same-snapshot race via redundantTaskIds", () => {
		const preHandlerState = makeBuildState(
			[
				{ id: 5, title: "Task E", status: "IN_PROGRESS", wave: 1 },
				{ id: 6, title: "Task F", status: "DONE", wave: 1 },
				{ id: 7, title: "Task G", status: "PENDING", wave: 1 },
			],
			{ currentWave: 1, currentTasks: [5] },
		);

		const dispatchResult = {
			action: "dispatch" as const,
			agent: "oc-implementer",
			prompt: "implement task 7",
			taskId: 7,
			phase: "BUILD",
		};

		// Without redundantTaskIds: task 7 was PENDING in preHandlerState → not stale
		expect(isStaleDispatch(dispatchResult, preHandlerState)).toBe(false);

		// With redundantTaskIds containing task 7 (sibling detected during merge): stale
		const redundant = new Set([7]);
		expect(isStaleDispatch(dispatchResult, preHandlerState, redundant)).toBe(true);
	});

	test("buildMergeTransform merges branchLifecycle.tasksPushed additively", () => {
		const baseState = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentWave: 1, currentTasks: [1, 2] },
		);
		const lifecycle = {
			currentBranch: "feat/test",
			baseBranch: "main",
			tasksPushed: [] as string[],
			prNumber: null,
			prUrl: null,
			worktreePath: null,
			createdAt: null,
			lastPushedAt: null,
		};
		const state: PipelineState = { ...baseState, branchLifecycle: lifecycle };

		const handlerAUpdates: Partial<PipelineState> = {
			tasks: state.tasks.map((t) => (t.id === 1 ? { ...t, status: "DONE" as const } : t)),
			branchLifecycle: {
				...lifecycle,
				tasksPushed: ["task-1-branch"],
			},
		};

		const handlerBUpdates: Partial<PipelineState> = {
			tasks: state.tasks.map((t) => (t.id === 2 ? { ...t, status: "DONE" as const } : t)),
			branchLifecycle: {
				...lifecycle,
				tasksPushed: ["task-2-branch"],
			},
		};

		const { transform: transformA } = buildMergeTransform(handlerAUpdates, state);
		const afterA = transformA(state);
		expect(afterA.branchLifecycle?.tasksPushed).toContain("task-1-branch");

		const { transform: transformB } = buildMergeTransform(handlerBUpdates, state);
		const afterBoth = transformB(afterA);

		expect(afterBoth.branchLifecycle?.tasksPushed).toContain("task-1-branch");
		expect(afterBoth.branchLifecycle?.tasksPushed).toContain("task-2-branch");
	});

	test("extractDispatchTaskIds extracts IDs from dispatch and dispatch_multi", () => {
		const single = {
			action: "dispatch" as const,
			agent: "oc-implementer",
			prompt: "do",
			taskId: 3,
			phase: "BUILD",
		};
		expect(extractDispatchTaskIds(single)).toEqual([3]);

		const multi = {
			action: "dispatch_multi" as const,
			agents: [
				{ agent: "oc-implementer", prompt: "do 1", taskId: 1 },
				{ agent: "oc-implementer", prompt: "do 2", taskId: 2 },
			],
			phase: "BUILD",
		};
		expect(extractDispatchTaskIds(multi)).toEqual([1, 2]);

		const noTask = {
			action: "complete" as const,
			phase: "BUILD",
		};
		expect(extractDispatchTaskIds(noTask)).toEqual([]);
	});

	test("buildMergeTransform preserves branchLifecycle.tasksPushed when handler adds no new pushes", () => {
		const baseState = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentWave: 1, currentTasks: [1, 2] },
		);
		const lifecycle = {
			currentBranch: "feat/test",
			baseBranch: "main",
			tasksPushed: ["task-1-branch"],
			prNumber: null,
			prUrl: null,
			worktreePath: null,
			createdAt: null,
			lastPushedAt: null,
		};
		const diskState: PipelineState = { ...baseState, branchLifecycle: lifecycle };

		const failedTaskUpdates: Partial<PipelineState> = {
			tasks: baseState.tasks.map((t) => (t.id === 2 ? { ...t, status: "FAILED" as const } : t)),
			branchLifecycle: {
				...lifecycle,
				tasksPushed: [],
			},
		};

		const { transform } = buildMergeTransform(failedTaskUpdates, baseState);
		const merged = transform(diskState);

		expect(merged.branchLifecycle?.tasksPushed).toContain("task-1-branch");
		expect(merged.branchLifecycle?.tasksPushed).not.toContain("task-2-branch");
	});

	test("handleBuild pending path includes branchLifecycle in _stateUpdates", async () => {
		const lifecycle = {
			currentBranch: "feat/test",
			baseBranch: "main",
			tasksPushed: ["prior-push"],
			prNumber: null,
			prUrl: null,
			worktreePath: null,
			createdAt: null,
			lastPushedAt: null,
		};
		const baseState = makeBuildState(
			[
				{ id: 1, title: "Task A", status: "IN_PROGRESS", wave: 1 },
				{ id: 2, title: "Task B", status: "IN_PROGRESS", wave: 1 },
			],
			{ currentTask: null, currentTasks: [1, 2], currentWave: 1 },
		);
		const state: PipelineState = { ...baseState, branchLifecycle: lifecycle };

		const result = await handleBuild(state, tempDir, "task 1 done", {
			envelope: {
				schemaVersion: 1,
				resultId: "r1",
				runId: "run-1",
				phase: "BUILD",
				dispatchId: "d1",
				agent: "oc-implementer",
				kind: "task_completion",
				taskId: 1,
				payload: { text: "task 1 done" },
			},
		});

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_BUILD_RESULT_PENDING");
		expect(result._stateUpdates?.tasks?.find((t) => t.id === 1)?.status).toBe("DONE");
		expect(result._stateUpdates?.branchLifecycle).toBeDefined();
		expect(result._stateUpdates?.branchLifecycle?.tasksPushed).toContain("1");
		expect(result._stateUpdates?.branchLifecycle?.tasksPushed).toContain("prior-push");
	});
});
