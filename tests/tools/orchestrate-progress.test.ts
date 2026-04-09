import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { orchestrateCore } from "../../src/tools/orchestrate";
import { ProgressTracker } from "../../src/ux/progress";
import { registerProgressTracker, resetUxRegistry } from "../../src/ux/registry";

let tempDir: string;
let tracker: ProgressTracker;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "orchestrate-progress-test-"));
	tracker = new ProgressTracker();
	registerProgressTracker(tracker);
});

afterEach(async () => {
	resetUxRegistry();
	await rm(tempDir, { recursive: true, force: true });
});

describe("orchestrateCore progress integration", () => {
	test("tracks multi-dispatch BUILD batches using the number of dispatched tasks", async () => {
		const baseState = createInitialState("build parallel tasks");
		await saveState(
			{
				...baseState,
				status: "IN_PROGRESS",
				currentPhase: "BUILD",
				phases: baseState.phases.map((phase) => ({
					...phase,
					status:
						phase.name === "BUILD"
							? ("IN_PROGRESS" as const)
							: phase.phaseNumber < 6
								? ("DONE" as const)
								: ("PENDING" as const),
				})),
				tasks: [
					{
						id: 1,
						title: "Task 1",
						status: "PENDING",
						wave: 1,
						depends_on: [],
						attempt: 0,
						strike: 0,
					},
					{
						id: 2,
						title: "Task 2",
						status: "PENDING",
						wave: 1,
						depends_on: [],
						attempt: 0,
						strike: 0,
					},
				],
			},
			tempDir,
		);

		const dispatch = JSON.parse(await orchestrateCore({}, tempDir));

		expect(dispatch.action).toBe("dispatch_multi");
		expect(dispatch.agents).toHaveLength(2);
		expect(tracker.getProgress()).toEqual({
			current: 0,
			total: 2,
			label: "BUILD",
			detail: "Starting phase",
		});

		const firstAgent = dispatch.agents[0];
		const resultEnvelope = {
			schemaVersion: 1,
			resultId: "progress-envelope-1",
			runId: dispatch.runId,
			phase: "BUILD",
			dispatchId: firstAgent.dispatchId,
			agent: firstAgent.agent,
			kind: "task_completion",
			taskId: firstAgent.taskId,
			payload: { text: "done" },
		};

		const result = JSON.parse(
			await orchestrateCore({ result: JSON.stringify(resultEnvelope) }, tempDir),
		);

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_BUILD_RESULT_PENDING");
		expect(tracker.getProgress()).toEqual({
			current: 1,
			total: 2,
			label: "BUILD task 1",
			detail: "Starting phase",
		});
	});
});
