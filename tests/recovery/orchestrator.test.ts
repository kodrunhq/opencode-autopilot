import { describe, expect, test } from "bun:test";
import { RecoveryOrchestrator } from "../../src/recovery/orchestrator";

describe("RecoveryOrchestrator", () => {
	test("tracks full recovery lifecycle", () => {
		const orchestrator = new RecoveryOrchestrator({ maxAttempts: 3 });
		const action = orchestrator.handleError("sess-1", "rate limit exceeded");

		expect(action).not.toBeNull();
		expect(action?.strategy).toBe("retry");

		const state = orchestrator.getState("sess-1");
		expect(state).not.toBeNull();
		expect(state?.attempts).toHaveLength(1);
		expect(state?.isRecovering).toBe(true);

		orchestrator.recordResult("sess-1", true);
		const completedState = orchestrator.getState("sess-1");
		expect(completedState?.attempts[0]?.success).toBe(true);
		expect(completedState?.isRecovering).toBe(false);
		expect(completedState?.currentStrategy).toBeNull();
	});

	test("enforces max attempt limit", () => {
		const orchestrator = new RecoveryOrchestrator({ maxAttempts: 3 });
		expect(orchestrator.handleError("sess-2", "timeout error")).not.toBeNull();
		orchestrator.recordResult("sess-2", false);
		expect(orchestrator.handleError("sess-2", "timeout error")).not.toBeNull();
		orchestrator.recordResult("sess-2", false);
		expect(orchestrator.handleError("sess-2", "timeout error")).not.toBeNull();
		orchestrator.recordResult("sess-2", false);
		expect(orchestrator.handleError("sess-2", "timeout error")).toBeNull();
	});

	test("returns null for non-recoverable errors", () => {
		const orchestrator = new RecoveryOrchestrator();
		expect(orchestrator.handleError("sess-3", "api key unauthorized")).toBeNull();
		expect(orchestrator.getState("sess-3")).toBeNull();
	});

	test("reset clears state and history", () => {
		const orchestrator = new RecoveryOrchestrator();
		orchestrator.handleError("sess-4", "network failure");
		expect(orchestrator.getHistory("sess-4")).toHaveLength(1);
		orchestrator.reset("sess-4");
		expect(orchestrator.getState("sess-4")).toBeNull();
		expect(orchestrator.getHistory("sess-4")).toHaveLength(0);
	});
});
