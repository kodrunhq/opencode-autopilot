import { describe, expect, test } from "bun:test";
import { classifyError } from "../../src/recovery/classifier";

describe("classifyError", () => {
	test("classifies extended error patterns", () => {
		expect(classifyError("empty content returned").category).toBe("empty_content");
		expect(classifyError("reasoning failed in thinking block").category).toBe(
			"thinking_block_error",
		);
		expect(classifyError("result too large for tool output").category).toBe("tool_result_overflow");
		expect(classifyError("context window exceeded").category).toBe("context_window_exceeded");
		expect(classifyError("session corrupt after invalid state").category).toBe(
			"session_corruption",
		);
		expect(classifyError("loop detected and no progress").category).toBe("agent_loop_stuck");
	});

	test("classifies base error categories", () => {
		expect(classifyError(new Error("rate limit exceeded")).category).toBe("rate_limit");
		expect(classifyError(new Error("API key unauthorized")).category).toBe("auth_failure");
		expect(classifyError(new Error("quota exceeded")).category).toBe("quota_exceeded");
		expect(classifyError(new Error("service unavailable")).category).toBe("service_unavailable");
		expect(classifyError(new Error("request timeout")).category).toBe("timeout");
		expect(classifyError(new Error("network connection reset")).category).toBe("network");
		expect(classifyError(new Error("validation failed")).category).toBe("validation");
	});

	test("uses context when classifying", () => {
		const result = classifyError("unknown", { message: "max tokens reached" });
		expect(result.category).toBe("context_window_exceeded");
	});

	test("marks only auth failure and session corruption as non-recoverable", () => {
		expect(classifyError("api key unauthorized").isRecoverable).toBe(false);
		expect(classifyError("session corrupt state mismatch").isRecoverable).toBe(false);
		expect(classifyError("network error").isRecoverable).toBe(true);
	});

	test("falls back to unknown for unmatched errors", () => {
		const result = classifyError("completely novel failure");
		expect(result.category).toBe("unknown");
		expect(result.confidence).toBeLessThan(0.5);
	});
});
