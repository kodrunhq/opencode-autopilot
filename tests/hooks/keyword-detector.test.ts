import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	clearKeywordDetectorTracking,
	createKeywordDetectorHandler,
} from "../../src/hooks/keyword-detector";

function makeShowToast() {
	return mock((_title: string, _message: string, _variant: "info" | "warning" | "error") =>
		Promise.resolve(),
	);
}

function makeHookInput(overrides: {
	tool?: string;
	sessionID?: string;
	callID?: string;
	args?: unknown;
}) {
	return {
		tool: overrides.tool ?? "some_tool",
		sessionID: overrides.sessionID ?? "session-1",
		callID: overrides.callID ?? "call-1",
		args: overrides.args ?? { key: "value" },
	};
}

function makeOutput(output = "") {
	return { title: "result", output, metadata: {} };
}

describe("createKeywordDetectorHandler", () => {
	beforeEach(() => {
		clearKeywordDetectorTracking();
	});

	afterEach(() => {
		clearKeywordDetectorTracking();
	});

	it("returns a function", () => {
		const handler = createKeywordDetectorHandler({ showToast: makeShowToast() });
		expect(typeof handler).toBe("function");
	});

	it("does not trigger toast on a single tool call", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });

		await handler(makeHookInput({ tool: "bash", sessionID: "s1" }), makeOutput("ok"));

		expect(showToast).not.toHaveBeenCalled();
	});

	it("does not trigger toast on two consecutive identical calls", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });
		const input = makeHookInput({ tool: "bash", sessionID: "s1", args: { cmd: "ls" } });

		await handler(input, makeOutput());
		await handler(input, makeOutput());

		expect(showToast).not.toHaveBeenCalled();
	});

	it("triggers repetition toast on 3 consecutive identical calls to the same tool", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });
		const input = makeHookInput({ tool: "bash", sessionID: "s1", args: { cmd: "ls" } });

		await handler(input, makeOutput());
		await handler(input, makeOutput());
		await handler(input, makeOutput());

		expect(showToast).toHaveBeenCalledTimes(1);
		const [title, message, variant] = showToast.mock.lastCall ?? [];
		expect(title).toBe("Repetition detected");
		expect(message).toContain("bash");
		expect(variant).toBe("warning");
	});

	it("triggers repetition toast on every call after the 3rd identical consecutive call", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });
		const input = makeHookInput({ tool: "grep", sessionID: "s1", args: { pattern: "foo" } });

		await handler(input, makeOutput());
		await handler(input, makeOutput());
		await handler(input, makeOutput());
		await handler(input, makeOutput());

		expect(showToast.mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it("does not trigger repetition toast when args differ between calls", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });
		const sessionID = "s1";

		await handler(makeHookInput({ tool: "bash", sessionID, args: { cmd: "ls" } }), makeOutput());
		await handler(makeHookInput({ tool: "bash", sessionID, args: { cmd: "pwd" } }), makeOutput());
		await handler(makeHookInput({ tool: "bash", sessionID, args: { cmd: "echo" } }), makeOutput());

		expect(showToast).not.toHaveBeenCalled();
	});

	it("detects stuck keywords in tool output when 2+ phrases match", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });

		const stuckOutput = "I apologize for the issue. I cannot complete this task.";
		await handler(makeHookInput({ sessionID: "s1" }), makeOutput(stuckOutput));

		expect(showToast).toHaveBeenCalledTimes(1);
		const [title, , variant] = showToast.mock.lastCall ?? [];
		expect(title).toBe("Agent may be stuck");
		expect(variant).toBe("warning");
	});

	it("does not trigger stuck-keyword toast when only 1 phrase matches", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });

		const outputWithOnePhrase = "I apologize for the confusion.";
		await handler(makeHookInput({ sessionID: "s1" }), makeOutput(outputWithOnePhrase));

		expect(showToast).not.toHaveBeenCalled();
	});

	it("does not trigger stuck-keyword toast on normal tool output", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });

		const normalOutput = "Successfully ran the command. All done.";
		await handler(makeHookInput({ sessionID: "s1" }), makeOutput(normalOutput));

		expect(showToast).not.toHaveBeenCalled();
	});

	it("tracks different sessions independently — repetition in one does not affect another", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });

		const inputA = makeHookInput({ tool: "bash", sessionID: "session-A", args: { cmd: "ls" } });
		const inputB = makeHookInput({ tool: "bash", sessionID: "session-B", args: { cmd: "ls" } });

		await handler(inputA, makeOutput());
		await handler(inputA, makeOutput());
		await handler(inputB, makeOutput());

		expect(showToast).not.toHaveBeenCalled();
	});

	it("clears state across sessions after clearKeywordDetectorTracking()", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });
		const input = makeHookInput({ tool: "bash", sessionID: "s1", args: { cmd: "ls" } });

		await handler(input, makeOutput());
		await handler(input, makeOutput());

		clearKeywordDetectorTracking();

		await handler(input, makeOutput());
		await handler(input, makeOutput());

		expect(showToast).not.toHaveBeenCalled();
	});

	it("resets repetition count when a different tool is called in between", async () => {
		const showToast = makeShowToast();
		const handler = createKeywordDetectorHandler({ showToast });
		const sessionID = "s1";

		await handler(makeHookInput({ tool: "bash", sessionID, args: { cmd: "ls" } }), makeOutput());
		await handler(makeHookInput({ tool: "bash", sessionID, args: { cmd: "ls" } }), makeOutput());
		await handler(
			makeHookInput({ tool: "read_file", sessionID, args: { path: "a.ts" } }),
			makeOutput(),
		);
		await handler(makeHookInput({ tool: "bash", sessionID, args: { cmd: "ls" } }), makeOutput());

		expect(showToast).not.toHaveBeenCalled();
	});
});
