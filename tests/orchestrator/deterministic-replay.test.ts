import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replayEnvelopes } from "../../src/orchestrator/replay";
import { orchestrateCore } from "../../src/tools/orchestrate";

describe("deterministic replay", () => {
	let tempDirA: string;
	let tempDirB: string;

	beforeEach(async () => {
		tempDirA = await mkdtemp(join(tmpdir(), "replay-a-"));
		tempDirB = await mkdtemp(join(tmpdir(), "replay-b-"));
	});

	afterEach(async () => {
		await rm(tempDirA, { recursive: true, force: true });
		await rm(tempDirB, { recursive: true, force: true });
	});

	test("same envelope trace yields same final state", async () => {
		const firstDispatchA = JSON.parse(
			await orchestrateCore({ idea: "build test app", intent: "implementation" }, tempDirA),
		);
		const firstDispatchB = JSON.parse(
			await orchestrateCore({ idea: "build test app", intent: "implementation" }, tempDirB),
		);

		const envelopeA = {
			schemaVersion: 1,
			resultId: "result-1",
			runId: firstDispatchA.runId,
			phase: "RECON",
			dispatchId: firstDispatchA.dispatchId,
			agent: firstDispatchA.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "recon complete" },
		} as const;

		const envelopeB = {
			...envelopeA,
			runId: firstDispatchB.runId,
			dispatchId: firstDispatchB.dispatchId,
		} as const;

		await mkdir(join(tempDirA, "phases", "RECON"), { recursive: true });
		await writeFile(join(tempDirA, "phases", "RECON", "report.md"), "# Report\ntest report");
		await mkdir(join(tempDirB, "phases", "RECON"), { recursive: true });
		await writeFile(join(tempDirB, "phases", "RECON", "report.md"), "# Report\ntest report");

		await replayEnvelopes(tempDirA, [envelopeA]);
		await replayEnvelopes(tempDirB, [envelopeB]);

		const stateA = JSON.parse(await readFile(join(tempDirA, "state.json"), "utf-8"));
		const stateB = JSON.parse(await readFile(join(tempDirB, "state.json"), "utf-8"));

		expect(stateA.currentPhase).toBe("CHALLENGE");
		expect(stateB.currentPhase).toBe("CHALLENGE");
		expect(stateA.phases.map((p: { name: string; status: string }) => [p.name, p.status])).toEqual(
			stateB.phases.map((p: { name: string; status: string }) => [p.name, p.status]),
		);
	});

	test("duplicate result envelope is rejected deterministically", async () => {
		const dispatch = JSON.parse(
			await orchestrateCore({ idea: "dupe test", intent: "implementation" }, tempDirA),
		);
		const envelope = {
			schemaVersion: 1,
			resultId: "dup-result",
			runId: dispatch.runId,
			phase: "RECON",
			dispatchId: dispatch.dispatchId,
			agent: dispatch.agent,
			kind: "phase_output",
			taskId: null,
			payload: { text: "done" },
		} as const;
		await mkdir(join(tempDirA, "phases", "RECON"), { recursive: true });
		await writeFile(join(tempDirA, "phases", "RECON", "report.md"), "# Report\ntest report");

		const first = JSON.parse(await orchestrateCore({ result: JSON.stringify(envelope) }, tempDirA));
		expect(first.action).toBe("dispatch");

		const second = JSON.parse(
			await orchestrateCore({ result: JSON.stringify(envelope) }, tempDirA),
		);
		expect(second.action).toBe("error");
		expect(second.code).toBe("E_DUPLICATE_RESULT");
	});

	test("unknown dispatch result is rejected", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "unknown dispatch", intent: "implementation" }, tempDirA),
		);
		const unknown = JSON.stringify({
			schemaVersion: 1,
			resultId: "unknown-1",
			runId: first.runId,
			phase: "RECON",
			dispatchId: "dispatch_unknown",
			agent: "oc-researcher",
			kind: "phase_output",
			taskId: null,
			payload: { text: "x" },
		});
		const result = JSON.parse(await orchestrateCore({ result: unknown }, tempDirA));
		expect(result.action).toBe("error");
		expect(result.code).toBe("E_UNKNOWN_DISPATCH");
	});

	test("phase mismatch result is rejected", async () => {
		const first = JSON.parse(
			await orchestrateCore({ idea: "phase mismatch", intent: "implementation" }, tempDirA),
		);
		const mismatch = JSON.stringify({
			schemaVersion: 1,
			resultId: "phase-mismatch-1",
			runId: first.runId,
			phase: "CHALLENGE",
			dispatchId: first.dispatchId,
			agent: "oc-researcher",
			kind: "phase_output",
			taskId: null,
			payload: { text: "x" },
		});
		const result = JSON.parse(await orchestrateCore({ result: mismatch }, tempDirA));
		expect(result.action).toBe("error");
		expect(result.code).toBe("E_PHASE_MISMATCH");
	});

	test("runId mismatch yields stale result error", async () => {
		await orchestrateCore({ idea: "stale run", intent: "implementation" }, tempDirA);
		const stale = JSON.stringify({
			schemaVersion: 1,
			resultId: "stale-1",
			runId: "old-run",
			phase: "RECON",
			dispatchId: "dispatch_x",
			agent: "oc-researcher",
			kind: "phase_output",
			taskId: null,
			payload: { text: "x" },
		});
		const result = JSON.parse(await orchestrateCore({ result: stale }, tempDirA));
		expect(result.action).toBe("error");
		expect(result.code).toBe("E_STALE_RESULT");
	});

	test("sequential BUILD result updates mark the current task done and dispatch the next one", async () => {
		const now = new Date().toISOString();
		const customState = {
			schemaVersion: 2,
			status: "IN_PROGRESS",
			runId: "run-build",
			stateRevision: 0,
			idea: "build-order-test",
			currentPhase: "BUILD",
			startedAt: now,
			lastUpdatedAt: now,
			phases: [
				{ name: "RECON", status: "DONE", completedAt: now, confidence: null },
				{ name: "CHALLENGE", status: "DONE", completedAt: now, confidence: null },
				{ name: "ARCHITECT", status: "DONE", completedAt: now, confidence: null },
				{ name: "EXPLORE", status: "DONE", completedAt: now, confidence: null },
				{ name: "PLAN", status: "DONE", completedAt: now, confidence: null },
				{ name: "BUILD", status: "IN_PROGRESS", completedAt: null, confidence: null },
				{ name: "SHIP", status: "PENDING", completedAt: null, confidence: null },
				{ name: "RETROSPECTIVE", status: "PENDING", completedAt: null, confidence: null },
			],
			decisions: [],
			confidence: [],
			tasks: [
				{
					id: 1,
					title: "Task A",
					status: "PENDING",
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
				{
					id: 2,
					title: "Task B",
					status: "PENDING",
					wave: 1,
					depends_on: [],
					attempt: 0,
					strike: 0,
				},
			],
			arenaConfidence: null,
			exploreTriggered: false,
			buildProgress: {
				currentTask: null,
				currentWave: null,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			pendingDispatches: [],
			processedResultIds: [],
			failureContext: null,
			phaseDispatchCounts: {},
		};

		await Bun.write(join(tempDirA, "state.json"), JSON.stringify(customState, null, 2));
		const dispatch = JSON.parse(await orchestrateCore({}, tempDirA));
		expect(dispatch.action).toBe("dispatch");
		expect(dispatch.taskId).toBe(1);

		const resultTask1 = {
			schemaVersion: 1,
			resultId: "build-1",
			runId: dispatch.runId,
			phase: "BUILD",
			dispatchId: dispatch.dispatchId,
			agent: dispatch.agent,
			kind: "task_completion",
			taskId: 1,
			payload: { text: "task 1 done" },
		};
		const secondDispatch = JSON.parse(
			await orchestrateCore({ result: JSON.stringify(resultTask1) }, tempDirA),
		);
		expect(secondDispatch.action).toBe("dispatch");
		expect(secondDispatch.taskId).toBe(2);

		const stateAfterFirst = JSON.parse(await readFile(join(tempDirA, "state.json"), "utf-8"));
		expect(
			stateAfterFirst.tasks.find((t: { id: number; status: string }) => t.id === 1).status,
		).toBe("DONE");
		expect(
			stateAfterFirst.tasks.find((t: { id: number; status: string }) => t.id === 2).status,
		).toBe("IN_PROGRESS");

		const resultTask2 = {
			schemaVersion: 1,
			resultId: "build-2",
			runId: secondDispatch.runId,
			phase: "BUILD",
			dispatchId: secondDispatch.dispatchId,
			agent: secondDispatch.agent,
			kind: "task_completion",
			taskId: 2,
			payload: { text: "task 2 done" },
		};
		await orchestrateCore({ result: JSON.stringify(resultTask2) }, tempDirA);

		const stateAfterSecond = JSON.parse(await readFile(join(tempDirA, "state.json"), "utf-8"));
		expect(
			stateAfterSecond.tasks.find((t: { id: number; status: string }) => t.id === 2).status,
		).toBe("DONE");
	});
});
