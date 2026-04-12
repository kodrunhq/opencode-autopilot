import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { orchestrateCore } from "../../src/tools/orchestrate";
import { NotificationManager } from "../../src/ux/notifications";
import { ProgressTracker } from "../../src/ux/progress";
import {
	registerProgressTracker,
	registerTaskToastManager,
	resetUxRegistry,
} from "../../src/ux/registry";
import { TaskToastManager } from "../../src/ux/task-toast-manager";

let tempDir: string;
let tracker: ProgressTracker;
let taskToastManager: TaskToastManager;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "orchestrate-ux-test-"));
	const notifications = new NotificationManager();
	tracker = new ProgressTracker({ notificationManager: notifications });
	taskToastManager = new TaskToastManager(notifications);
	registerProgressTracker(tracker);
	registerTaskToastManager(taskToastManager);
});

afterEach(async () => {
	resetUxRegistry();
	await rm(tempDir, { recursive: true, force: true });
});

function createBuildState() {
	const state = createInitialState("test idea");
	return {
		...state,
		currentPhase: "BUILD" as const,
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
			oraclePending: false,
			oracleSignoffId: null,
			oracleInputsDigest: null,
			lastReviewReport: null,
		},
		phases: state.phases.map((phase) =>
			["RECON", "CHALLENGE", "ARCHITECT", "EXPLORE", "PLAN"].includes(phase.name)
				? { ...phase, status: "DONE" as const }
				: phase.name === "BUILD"
					? { ...phase, status: "IN_PROGRESS" as const }
					: phase,
		),
	};
}

describe("orchestrateCore UX integration", () => {
	test("fresh broad run returns curated visibility events for tranche and phase start", async () => {
		const result = JSON.parse(
			await orchestrateCore(
				{
					idea: [
						"Implement the remediation program:",
						"1. Add program and tranche persistence.",
						"2. Add autonomous tranche planning heuristics.",
						"3. Continue automatically across multiple PRs.",
					].join("\n"),
					intent: "implementation",
				},
				tempDir,
			),
		);

		expect(result.displayText).toContain("Tranche 1/");
		expect(result.displayText).toContain("[1/8]");
		expect(result.visibility.events.map((event: { type: string }) => event.type)).toEqual([
			"tranche_started",
			"phase_started",
		]);
	});

	test("dispatch_multi registers running tasks and phase progress", async () => {
		await saveState(createBuildState(), tempDir);

		const result = JSON.parse(await orchestrateCore({}, tempDir));
		expect(result.action).toBe("dispatch_multi");
		expect(taskToastManager.getRunningTasks()).toHaveLength(2);
		expect(tracker.getProgress()).toEqual({
			current: 0,
			total: 2,
			label: "BUILD",
			detail: "Starting phase",
		});
	});

	test("successful task result advances progress and removes completed task toast", async () => {
		await saveState(createBuildState(), tempDir);

		const first = JSON.parse(await orchestrateCore({}, tempDir));
		expect(first.action).toBe("dispatch_multi");

		const agent = first.agents[0];
		const resultEnvelope = {
			schemaVersion: 1,
			resultId: "ux-build-result-1",
			runId: first.runId,
			phase: "BUILD",
			dispatchId: agent.dispatchId,
			agent: agent.agent,
			kind: agent.resultKind,
			taskId: agent.taskId,
			payload: { text: "task completed successfully" },
		};

		const result = JSON.parse(
			await orchestrateCore({ result: JSON.stringify(resultEnvelope) }, tempDir),
		);

		expect(tracker.getProgress()?.current).toBe(1);
		expect(taskToastManager.getRunningTasks()).toHaveLength(1);
		expect(result.visibility.events.map((event: { type: string }) => event.type)).toContain(
			"task_completed",
		);
	});
});
