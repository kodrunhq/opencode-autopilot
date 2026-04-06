import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	clearRecoveryTracking,
	createSessionRecoveryHandler,
} from "../../src/hooks/session-recovery";

function makeShowToast() {
	return mock((_title: string, _message: string, _variant: "info" | "warning" | "error") =>
		Promise.resolve(),
	);
}

function makeHookInput(sessionID: string) {
	return { sessionID };
}

function makeOutput(output: string) {
	return { output };
}

describe("createSessionRecoveryHandler", () => {
	beforeEach(() => {
		clearRecoveryTracking();
	});

	afterEach(() => {
		clearRecoveryTracking();
	});

	it("returns a function", () => {
		const handler = createSessionRecoveryHandler({ showToast: makeShowToast() });
		expect(typeof handler).toBe("function");
	});

	it("does not trigger toast on a single error output", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), makeOutput("An error occurred"));

		expect(showToast).not.toHaveBeenCalled();
	});

	it("does not trigger toast on two consecutive error outputs", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), makeOutput("error: something went wrong"));
		await handler(makeHookInput("s1"), makeOutput("failed to connect"));

		expect(showToast).not.toHaveBeenCalled();
	});

	it("triggers recovery toast after 3 consecutive error outputs", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), makeOutput("error occurred"));
		await handler(makeHookInput("s1"), makeOutput("request failed"));
		await handler(makeHookInput("s1"), makeOutput("exception thrown"));

		expect(showToast).toHaveBeenCalledTimes(1);
		const [title, message, variant] = showToast.mock.lastCall ?? [];
		expect(title).toBe("Recovery suggestion");
		expect(message).toContain("oc_recover");
		expect(variant).toBe("warning");
	});

	it("does not trigger toast again after the 3rd error (only fires at exactly 3)", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), makeOutput("error"));
		await handler(makeHookInput("s1"), makeOutput("failed"));
		await handler(makeHookInput("s1"), makeOutput("exception"));
		await handler(makeHookInput("s1"), makeOutput("another error"));

		expect(showToast).toHaveBeenCalledTimes(1);
	});

	it("resets consecutive error counter on a successful (non-error) output", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), makeOutput("error"));
		await handler(makeHookInput("s1"), makeOutput("failed"));
		await handler(makeHookInput("s1"), makeOutput("all done successfully"));
		await handler(makeHookInput("s1"), makeOutput("error"));
		await handler(makeHookInput("s1"), makeOutput("failed"));

		expect(showToast).not.toHaveBeenCalled();
	});

	it("triggers toast again after reset if 3 more consecutive errors occur", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), makeOutput("error"));
		await handler(makeHookInput("s1"), makeOutput("failed"));
		await handler(makeHookInput("s1"), makeOutput("exception"));
		await handler(makeHookInput("s1"), makeOutput("ok success"));
		await handler(makeHookInput("s1"), makeOutput("error again"));
		await handler(makeHookInput("s1"), makeOutput("failed again"));
		await handler(makeHookInput("s1"), makeOutput("exception again"));

		expect(showToast).toHaveBeenCalledTimes(2);
	});

	it("detects error indicator case-insensitively", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), makeOutput("ERROR: something broke"));
		await handler(makeHookInput("s1"), makeOutput("FAILED to process"));
		await handler(makeHookInput("s1"), makeOutput("EXCEPTION: null pointer"));

		expect(showToast).toHaveBeenCalledTimes(1);
	});

	it("does not trigger on non-error output", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), makeOutput("Task completed successfully"));
		await handler(makeHookInput("s1"), makeOutput("All tests passed"));
		await handler(makeHookInput("s1"), makeOutput("Lint clean"));

		expect(showToast).not.toHaveBeenCalled();
	});

	it("handles different sessions independently", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("session-A"), makeOutput("error"));
		await handler(makeHookInput("session-A"), makeOutput("failed"));
		await handler(makeHookInput("session-B"), makeOutput("error"));
		await handler(makeHookInput("session-B"), makeOutput("failed"));
		await handler(makeHookInput("session-B"), makeOutput("exception"));

		expect(showToast).toHaveBeenCalledTimes(1);
		const [, , variant] = showToast.mock.lastCall ?? [];
		expect(variant).toBe("warning");
	});

	it("clearRecoveryTracking() resets error counts", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), makeOutput("error"));
		await handler(makeHookInput("s1"), makeOutput("failed"));

		clearRecoveryTracking();

		await handler(makeHookInput("s1"), makeOutput("error"));
		await handler(makeHookInput("s1"), makeOutput("failed"));
		await handler(
			makeHookInput("s1"),
			makeOutput("exception — should NOT fire because count reset"),
		);

		expect(showToast).toHaveBeenCalledTimes(1);
	});

	it("handles output with undefined output field gracefully", async () => {
		const showToast = makeShowToast();
		const handler = createSessionRecoveryHandler({ showToast });

		await handler(makeHookInput("s1"), {});
		await handler(makeHookInput("s1"), {});
		await handler(makeHookInput("s1"), {});

		expect(showToast).not.toHaveBeenCalled();
	});
});
