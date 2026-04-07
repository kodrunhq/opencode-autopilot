import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleBuild } from "../../src/orchestrator/handlers/build";
import { buildParallelDispatch } from "../../src/orchestrator/handlers/build-utils";
import { pipelineStateSchema } from "../../src/orchestrator/schemas";
import type { PipelineState } from "../../src/orchestrator/types";
import { computeLineHash, hashlineEditCore } from "../../src/tools/hashline-edit";

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

		const updatedTasks = result._stateUpdates?.tasks ?? [];
		const inProgressCount = updatedTasks.filter((t) => t.status === "IN_PROGRESS").length;
		// 4 original (2-5) + 1 newly dispatched (6) = 5, never exceeds maxParallel
		expect(inProgressCount).toBe(5);
		expect(updatedTasks.find((t) => t.id === 1)?.status).toBe("DONE");
		expect(updatedTasks.find((t) => t.id === 6)?.status).toBe("IN_PROGRESS");
		expect(updatedTasks.find((t) => t.id === 7)?.status).toBe("PENDING");
		expect(updatedTasks.find((t) => t.id === 8)?.status).toBe("PENDING");
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
});
