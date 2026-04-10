import { describe, expect, test } from "bun:test";
import { LoopStateMachine, loopStateMachineConstants } from "../../src/autonomy/state";

describe("LoopStateMachine", () => {
	test("allows valid transitions", () => {
		const machine = new LoopStateMachine(3, "Ship feature");

		machine.transition("running");
		expect(machine.getContext().state).toBe("running");

		machine.transition("verifying");
		expect(machine.getContext().state).toBe("verifying");

		machine.transition("oracle_verification_pending");
		expect(machine.getContext().state).toBe("oracle_verification_pending");

		machine.transition("running");
		machine.transition("complete");
		expect(machine.getContext().state).toBe("complete");
	});

	test("rejects invalid transitions", () => {
		const machine = new LoopStateMachine();

		expect(() => machine.transition("complete")).toThrow(
			"Invalid loop state transition: idle -> complete",
		);
	});

	test("enforces hard max iteration ceiling", () => {
		const machine = new LoopStateMachine(999);

		expect(machine.getContext().maxIterations).toBe(loopStateMachineConstants.HARD_MAX_ITERATIONS);
	});

	test("increments iteration count and reports when limit is exceeded", () => {
		const machine = new LoopStateMachine(1);
		machine.transition("running");

		expect(machine.incrementIteration()).toBe(false);
		expect(machine.getContext().currentIteration).toBe(1);
		expect(machine.incrementIteration()).toBe(true);
		expect(machine.getContext().currentIteration).toBe(2);
	});

	test("accumulates context entries", () => {
		const machine = new LoopStateMachine(3);
		machine.addContext("first pass");
		machine.addContext("second pass");

		expect(machine.getContext().accumulatedContext).toEqual(["first pass", "second pass"]);
	});

	test("stores oracle verification state", () => {
		const machine = new LoopStateMachine(3);
		machine.setOracleVerification({
			status: "pending",
			sessionId: "oracle-123",
			attemptCount: 1,
			maxAttempts: 3,
			lastResultSummary: "Needs one more fix",
		});

		expect(machine.getContext().oracleVerification).toEqual({
			status: "pending",
			sessionId: "oracle-123",
			attemptCount: 1,
			maxAttempts: 3,
			lastResultSummary: "Needs one more fix",
		});
	});
});
