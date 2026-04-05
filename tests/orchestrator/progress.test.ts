import { describe, expect, test } from "bun:test";
import { getPhaseProgressString } from "../../src/orchestrator/progress";
import type { PipelineState } from "../../src/orchestrator/types";

describe("Progress Display (Task 1)", () => {
	test("generates correct format for regular phases", () => {
		const state: any = {
			status: "IN_PROGRESS",
			currentPhase: "ARCHITECT",
			phases: [],
			tasks: [],
			buildProgress: {},
		};
		const progress = getPhaseProgressString(state as PipelineState);
		expect(progress).toBe("[3/8] Designing technical architecture...");
	});

	test("generates detailed build wave progress", () => {
		const state: any = {
			status: "IN_PROGRESS",
			currentPhase: "BUILD",
			phases: [],
			tasks: [
				{ wave: 1, name: "T1" },
				{ wave: 1, name: "T2" },
				{ wave: 2, name: "T3" },
			],
			buildProgress: {
				currentWave: 1,
				reviewPending: false,
			},
		};
		const progress = getPhaseProgressString(state as PipelineState);
		expect(progress).toBe("[6/8] Building wave 1/2 (2 tasks)...");
	});

	test("generates review pending progress", () => {
		const state: any = {
			status: "IN_PROGRESS",
			currentPhase: "BUILD",
			phases: [],
			tasks: [
				{ wave: 1, name: "T1" },
				{ wave: 2, name: "T2" },
			],
			buildProgress: {
				currentWave: 2,
				reviewPending: true,
			},
		};
		const progress = getPhaseProgressString(state as PipelineState);
		expect(progress).toBe("[6/8] Reviewing wave 2/2...");
	});
});
