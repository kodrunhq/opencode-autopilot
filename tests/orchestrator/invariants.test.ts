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

	test("detects pending dispatch from a non-current phase", () => {
		const state = createInitialState("pending mismatch");
		const broken = {
			...state,
			pendingDispatches: [
				{
					dispatchId: "dispatch_plan_1",
					phase: "PLAN" as const,
					agent: "oc-planner",
					issuedAt: new Date().toISOString(),
					resultKind: "phase_output" as const,
					taskId: null,
				},
			],
		};
		const violations = validateStateInvariants(broken);
		expect(violations.some((v) => v.code === "E_INVARIANT_PENDING_PHASE")).toBe(true);
	});

	test("detects pending dispatches on terminal state", () => {
		const state = createInitialState("terminal pending");
		const broken = {
			...state,
			currentPhase: null,
			status: "COMPLETED" as const,
			pendingDispatches: [
				{
					dispatchId: "dispatch_done_1",
					phase: "RECON" as const,
					agent: "oc-researcher",
					issuedAt: new Date().toISOString(),
					resultKind: "phase_output" as const,
					taskId: null,
				},
			],
		};
		const violations = validateStateInvariants(broken);
		expect(violations.some((v) => v.code === "E_INVARIANT_PENDING_PHASE")).toBe(true);
	});
});
