import { describe, expect, test } from "bun:test";
import { parseResultEnvelope } from "../../src/orchestrator/contracts/legacy-result-adapter";
import { planTasksArtifactSchema } from "../../src/orchestrator/contracts/phase-artifacts";
import { resultEnvelopeSchema } from "../../src/orchestrator/contracts/result-envelope";

describe("resultEnvelopeSchema", () => {
	test("accepts valid envelope", () => {
		const envelope = resultEnvelopeSchema.parse({
			schemaVersion: 1,
			resultId: "r-1",
			runId: "run-1",
			phase: "PLAN",
			dispatchId: "d-1",
			agent: "oc-planner",
			kind: "phase_output",
			taskId: null,
			payload: { text: "ok" },
		});
		expect(envelope.phase).toBe("PLAN");
	});

	test("rejects missing dispatchId", () => {
		expect(() =>
			resultEnvelopeSchema.parse({
				schemaVersion: 1,
				resultId: "r-1",
				runId: "run-1",
				phase: "PLAN",
				agent: "oc-planner",
				kind: "phase_output",
				taskId: null,
				payload: { text: "ok" },
			}),
		).toThrow();
	});

	test("typed malformed envelope does not silently fallback to legacy", () => {
		expect(() =>
			parseResultEnvelope(
				JSON.stringify({
					schemaVersion: 1,
					resultId: "x",
					runId: "run-1",
					phase: "NOT_A_PHASE",
					dispatchId: "d-1",
					agent: "oc-researcher",
					kind: "phase_output",
					taskId: null,
					payload: { text: "x" },
				}),
				{ runId: "run-1", phase: "RECON", fallbackDispatchId: "d-legacy" },
			),
		).toThrow("E_INVALID_RESULT");
	});
});

describe("planTasksArtifactSchema", () => {
	test("accepts valid tasks artifact", () => {
		const parsed = planTasksArtifactSchema.parse({
			schemaVersion: 1,
			tasks: [
				{ taskId: "W1-T01", title: "A", wave: 1, depends_on: [] },
				{ taskId: "W2-T01", title: "B", wave: 2, depends_on: ["W1-T01"] },
			],
		});
		expect(parsed.tasks.length).toBe(2);
	});

	test("rejects unknown dependency", () => {
		expect(() =>
			planTasksArtifactSchema.parse({
				schemaVersion: 1,
				tasks: [{ taskId: "W1-T01", title: "A", wave: 1, depends_on: ["W9-T99"] }],
			}),
		).toThrow();
	});
});
