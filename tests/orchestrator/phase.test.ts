import { describe, expect, test } from "bun:test";
import {
	completePhase,
	getNextPhase,
	getPhaseStatus,
	validateTransition,
} from "../../src/orchestrator/phase";
import { createInitialState } from "../../src/orchestrator/state";
import type { PipelineState } from "../../src/orchestrator/types";

describe("validateTransition", () => {
	test("RECON -> CHALLENGE does not throw", () => {
		expect(() => validateTransition("RECON", "CHALLENGE")).not.toThrow();
	});

	test("RECON -> BUILD throws with descriptive message", () => {
		expect(() => validateTransition("RECON", "BUILD")).toThrow(
			"Invalid phase transition",
		);
	});

	test("RETROSPECTIVE -> any throws (terminal phase)", () => {
		expect(() => validateTransition("RETROSPECTIVE", "RECON")).toThrow(
			"Invalid phase transition",
		);
	});

	test("each phase transitions to its successor", () => {
		const transitions: Array<[string, string]> = [
			["RECON", "CHALLENGE"],
			["CHALLENGE", "ARCHITECT"],
			["ARCHITECT", "EXPLORE"],
			["EXPLORE", "PLAN"],
			["PLAN", "BUILD"],
			["BUILD", "SHIP"],
			["SHIP", "RETROSPECTIVE"],
		];
		for (const [from, to] of transitions) {
			expect(() =>
				validateTransition(from as Parameters<typeof validateTransition>[0], to as Parameters<typeof validateTransition>[1]),
			).not.toThrow();
		}
	});
});

describe("getNextPhase", () => {
	test("RECON returns CHALLENGE", () => {
		expect(getNextPhase("RECON")).toBe("CHALLENGE");
	});

	test("RETROSPECTIVE returns null", () => {
		expect(getNextPhase("RETROSPECTIVE")).toBeNull();
	});

	test("BUILD returns SHIP", () => {
		expect(getNextPhase("BUILD")).toBe("SHIP");
	});
});

describe("completePhase", () => {
	test("completing RECON advances to CHALLENGE", () => {
		const state = createInitialState("test idea");
		const updated = completePhase(state);

		expect(updated.currentPhase).toBe("CHALLENGE");

		const reconStatus = updated.phases.find((p) => p.name === "RECON");
		expect(reconStatus?.status).toBe("DONE");
		expect(reconStatus?.completedAt).toBeTruthy();

		const challengeStatus = updated.phases.find((p) => p.name === "CHALLENGE");
		expect(challengeStatus?.status).toBe("IN_PROGRESS");
	});

	test("does not mutate original state", () => {
		const state = createInitialState("immutability test");
		const originalPhases = JSON.parse(JSON.stringify(state.phases));
		completePhase(state);
		expect(state.phases).toEqual(originalPhases);
		expect(state.currentPhase).toBe("RECON");
	});

	test("throws when currentPhase is null", () => {
		const state: PipelineState = {
			...createInitialState("null test"),
			currentPhase: null,
		};
		expect(() => completePhase(state)).toThrow();
	});

	test("completing RETROSPECTIVE sets currentPhase to null", () => {
		const state: PipelineState = {
			...createInitialState("terminal test"),
			currentPhase: "RETROSPECTIVE",
			phases: createInitialState("terminal test").phases.map((p) =>
				p.name === "RETROSPECTIVE"
					? { ...p, status: "IN_PROGRESS" as const }
					: { ...p, status: "DONE" as const, completedAt: "2026-01-01T00:00:00Z" },
			),
		};
		const updated = completePhase(state);
		expect(updated.currentPhase).toBeNull();
		const retroStatus = updated.phases.find((p) => p.name === "RETROSPECTIVE");
		expect(retroStatus?.status).toBe("DONE");
		expect(retroStatus?.completedAt).toBeTruthy();
	});
});

describe("getPhaseStatus", () => {
	test("returns PhaseStatus for existing phase", () => {
		const state = createInitialState("status test");
		const status = getPhaseStatus(state, "RECON");
		expect(status).toBeDefined();
		expect(status?.name).toBe("RECON");
		expect(status?.status).toBe("IN_PROGRESS");
	});

	test("returns undefined for phase not in state", () => {
		const state: PipelineState = {
			...createInitialState("empty phases"),
			phases: [],
		};
		const status = getPhaseStatus(state, "RECON");
		expect(status).toBeUndefined();
	});
});
