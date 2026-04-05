import { describe, expect, test } from "bun:test";
import { getStrategy } from "../../src/recovery/strategies";
import type { RecoveryState } from "../../src/recovery/types";
import type { ErrorCategory } from "../../src/types/recovery";

function createState(overrides: Partial<RecoveryState> = {}): RecoveryState {
	return {
		sessionId: overrides.sessionId ?? "sess-1",
		attempts: overrides.attempts ?? Object.freeze([]),
		currentStrategy: overrides.currentStrategy ?? null,
		maxAttempts: overrides.maxAttempts ?? 3,
		isRecovering: overrides.isRecovering ?? false,
		lastError: overrides.lastError ?? null,
	};
}

describe("getStrategy", () => {
	test("produces retry_with_backoff actions", () => {
		const action = getStrategy("rate_limit")(
			createState({
				attempts: Object.freeze([
					{
						attemptNumber: 1,
						strategy: "retry",
						errorCategory: "rate_limit",
						timestamp: new Date().toISOString(),
						success: false,
					},
				]),
			}),
		);
		expect(action.strategy).toBe("retry");
		expect(action.errorCategory).toBe("rate_limit");
		expect(action.backoffMs).toBe(2000);
	});

	test("produces compact and retry actions", () => {
		const action = getStrategy("tool_result_overflow")(createState());
		expect(action.strategy).toBe("compact_and_retry");
		expect(action.errorCategory).toBe("tool_result_overflow");
	});

	test("produces fallback model actions", () => {
		const action = getStrategy("empty_content")(createState());
		expect(action.strategy).toBe("fallback_model");
	});

	test("produces restart session actions", () => {
		const action = getStrategy("session_corruption")(createState());
		expect(action.strategy).toBe("restart_session");
	});

	test("produces reduce context after prior context attempt", () => {
		const action = getStrategy("context_window_exceeded")(
			createState({
				attempts: Object.freeze([
					{
						attemptNumber: 1,
						strategy: "compact_and_retry",
						errorCategory: "context_window_exceeded",
						timestamp: new Date().toISOString(),
						success: false,
					},
				]),
			}),
		);
		expect(action.strategy).toBe("reduce_context");
	});

	test("produces skip and continue actions", () => {
		const action = getStrategy("agent_loop_stuck")(createState());
		expect(action.strategy).toBe("skip_and_continue");
	});

	test("all required categories produce valid actions", () => {
		const categories: readonly ErrorCategory[] = [
			"rate_limit",
			"timeout",
			"network",
			"service_unavailable",
			"context_window_exceeded",
			"tool_result_overflow",
			"empty_content",
			"thinking_block_error",
			"session_corruption",
			"agent_loop_stuck",
		];

		for (const category of categories) {
			const action = getStrategy(category)(createState());
			expect(typeof action.strategy).toBe("string");
			expect(action.errorCategory).toBe(category);
			expect(action.maxAttempts).toBe(3);
			expect(action.backoffMs).toBeGreaterThanOrEqual(0);
		}
	});
});
