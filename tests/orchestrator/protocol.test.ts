import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { orchestrateCore } from "../../src/tools/orchestrate";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "protocol-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("orchestrator protocol hardening", () => {
	test("pending phase_output dispatch rejects review_findings envelope", async () => {
		const first = JSON.parse(await orchestrateCore({ idea: "protocol mismatch" }, tempDir));
		const result = JSON.parse(
			await orchestrateCore(
				{
					result: JSON.stringify({
						schemaVersion: 1,
						resultId: "proto-1",
						runId: first.runId,
						phase: "RECON",
						dispatchId: first.dispatchId,
						agent: first.agent,
						kind: "review_findings",
						taskId: null,
						payload: { text: "wrong kind" },
					}),
				},
				tempDir,
			),
		);

		expect(result.action).toBe("error");
		expect(result.code).toBe("E_RESULT_KIND_MISMATCH");
	});

	test("task completion with correct pending dispatch succeeds when protocol matches", async () => {
		const state = createInitialState("protocol success");
		const buildState = {
			...state,
			currentPhase: "BUILD" as const,
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
				currentWave: 1,
				attemptCount: 0,
				strikeCount: 0,
				reviewPending: false,
			},
			pendingDispatches: [
				{
					dispatchId: "dispatch_build_ok",
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

		const result = JSON.parse(
			await orchestrateCore(
				{
					result: JSON.stringify({
						schemaVersion: 1,
						resultId: "proto-ok-1",
						runId: buildState.runId,
						phase: "BUILD",
						dispatchId: "dispatch_build_ok",
						agent: "oc-implementer",
						kind: "task_completion",
						taskId: 1,
						payload: { text: "done" },
					}),
				},
				tempDir,
			),
		);

		expect(["dispatch", "complete"]).toContain(result.action);
	});
});
