import { describe, expect, test } from "bun:test";
import { validateStateInvariants } from "../../src/orchestrator/contracts/invariants";
import { createInitialState } from "../../src/orchestrator/state";

describe("validateStateInvariants", () => {
	test("returns no violations for initial state", () => {
		const state = createInitialState("test");
		expect(validateStateInvariants(state)).toHaveLength(0);
	});

	test("detects currentPhase mismatch", () => {
		const state = createInitialState("test");
		const broken = {
			...state,
			currentPhase: "PLAN" as const,
		};
		const violations = validateStateInvariants(broken);
		expect(violations.some((v) => v.code === "E_INVARIANT_CURRENT_PHASE_MISMATCH")).toBe(true);
	});

	test("detects invalid build currentTask reference", () => {
		const state = createInitialState("test");
		const broken = {
			...state,
			buildProgress: {
				...state.buildProgress,
				currentTask: 99,
			},
		};
		const violations = validateStateInvariants(broken);
		expect(violations.some((v) => v.code === "E_INVARIANT_BUILD_TASK")).toBe(true);
	});
});
