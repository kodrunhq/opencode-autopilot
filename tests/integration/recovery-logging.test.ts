import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Logger } from "../../src/logging/types";
import { classifyError } from "../../src/recovery/classifier";
import { RecoveryOrchestrator } from "../../src/recovery/orchestrator";
import { getStrategy } from "../../src/recovery/strategies";

function createTestLogger(): Logger & {
	readonly entries: Array<{
		readonly level: string;
		readonly message: string;
		readonly meta: Record<string, unknown>;
	}>;
} {
	const entries: Array<{
		readonly level: string;
		readonly message: string;
		readonly meta: Record<string, unknown>;
	}> = [];

	const log =
		(level: string) =>
		(message: string, meta: Record<string, unknown> = {}) => {
			entries.push({ level, message, meta });
		};

	return {
		entries,
		debug: log("debug"),
		info: log("info"),
		warn: log("warn"),
		error: log("error"),
		child: () => createTestLogger(),
	};
}

describe("Integration: recovery + logging end-to-end", () => {
	let logger: ReturnType<typeof createTestLogger>;
	let orchestrator: RecoveryOrchestrator;

	beforeEach(() => {
		logger = createTestLogger();
		orchestrator = new RecoveryOrchestrator({
			maxAttempts: 3,
			logger,
		});
	});

	afterEach(() => {
		orchestrator.reset("test-session");
	});

	test("rate limit error → classify → strategy → recovery action → log entries", () => {
		// Step 1: Classify the error
		const classification = classifyError("429 Too many requests - rate limit exceeded");
		expect(classification.category).toBe("rate_limit");
		expect(classification.confidence).toBeGreaterThan(0.9);
		expect(classification.isRecoverable).toBe(true);

		// Step 2: Get the strategy for this category
		const resolver = getStrategy(classification.category);
		const mockState = {
			sessionId: "test-session",
			attempts: Object.freeze([]),
			currentStrategy: null,
			maxAttempts: 3,
			isRecovering: false,
			lastError: null,
		};
		const action = resolver(mockState);
		expect(action.strategy).toBe("retry");
		expect(action.errorCategory).toBe("rate_limit");
		expect(action.backoffMs).toBeGreaterThan(0);

		// Step 3: Handle via orchestrator (produces log entries)
		const recoveryAction = orchestrator.handleError(
			"test-session",
			"429 Too many requests - rate limit exceeded",
		);
		expect(recoveryAction).not.toBeNull();
		expect(recoveryAction?.strategy).toBe("retry");

		// Step 4: Verify recovery state
		const state = orchestrator.getState("test-session");
		expect(state).not.toBeNull();
		expect(state?.attempts).toHaveLength(1);
		expect(state?.attempts[0].errorCategory).toBe("rate_limit");
		expect(state?.isRecovering).toBe(true);
	});

	test("context window exceeded → compact_and_retry on first attempt, reduce_context on second", () => {
		// First attempt: should use compact_and_retry
		const firstAction = orchestrator.handleError(
			"test-session",
			"context window exceeded: token limit reached",
		);
		expect(firstAction).not.toBeNull();
		expect(firstAction?.strategy).toBe("compact_and_retry");

		orchestrator.recordResult("test-session", false);

		// Second attempt: should use reduce_context
		const secondAction = orchestrator.handleError(
			"test-session",
			"context window exceeded: token limit reached",
		);
		expect(secondAction).not.toBeNull();
		expect(secondAction?.strategy).toBe("reduce_context");

		const state = orchestrator.getState("test-session");
		expect(state?.attempts).toHaveLength(2);
	});

	test("auth failure → non-recoverable → null action", () => {
		const classification = classifyError("Unauthorized: invalid API key");
		expect(classification.category).toBe("auth_failure");
		expect(classification.isRecoverable).toBe(false);

		const action = orchestrator.handleError("test-session", "Unauthorized: invalid API key");
		expect(action).toBeNull();

		const warnEntries = logger.entries.filter(
			(entry) => entry.level === "warn" && entry.message.includes("non-recoverable"),
		);
		expect(warnEntries).toHaveLength(1);
		expect(warnEntries[0].meta.category).toBe("auth_failure");
	});

	test("max attempts exhausted → null action after 3 retries", () => {
		// Attempt 1
		const action1 = orchestrator.handleError("test-session", "service unavailable - 503");
		expect(action1).not.toBeNull();
		orchestrator.recordResult("test-session", false);

		// Attempt 2
		const action2 = orchestrator.handleError("test-session", "service unavailable - 503");
		expect(action2).not.toBeNull();
		orchestrator.recordResult("test-session", false);

		// Attempt 3
		const action3 = orchestrator.handleError("test-session", "service unavailable - 503");
		expect(action3).not.toBeNull();
		orchestrator.recordResult("test-session", false);

		// Attempt 4: should be null (max attempts reached)
		const action4 = orchestrator.handleError("test-session", "service unavailable - 503");
		expect(action4).toBeNull();

		const warnEntries = logger.entries.filter(
			(entry) => entry.level === "warn" && entry.message.includes("attempt limit"),
		);
		expect(warnEntries).toHaveLength(1);
	});

	test("successful recovery resets recovering state", () => {
		const action = orchestrator.handleError(
			"test-session",
			"timeout: request timed out after 30000ms",
		);
		expect(action).not.toBeNull();
		expect(action?.strategy).toBe("retry");

		// Mark recovery as successful
		orchestrator.recordResult("test-session", true);
		const state = orchestrator.getState("test-session");
		expect(state?.isRecovering).toBe(false);
		expect(state?.lastError).toBeNull();
		expect(state?.attempts[0].success).toBe(true);
	});

	test("multiple error categories in sequence produce correct history", () => {
		// Error 1: timeout
		orchestrator.handleError("test-session", "request timed out");
		orchestrator.recordResult("test-session", false);

		// Error 2: network
		orchestrator.handleError("test-session", "ECONNRESET connection reset");
		orchestrator.recordResult("test-session", false);

		// Error 3: rate limit
		orchestrator.handleError("test-session", "429 rate limit hit");
		orchestrator.recordResult("test-session", true);

		const history = orchestrator.getHistory("test-session");
		expect(history).toHaveLength(3);
		expect(history[0].errorCategory).toBe("timeout");
		expect(history[0].success).toBe(false);
		expect(history[1].errorCategory).toBe("network");
		expect(history[1].success).toBe(false);
		expect(history[2].errorCategory).toBe("rate_limit");
		expect(history[2].success).toBe(true);
	});

	test("all error categories map to expected strategies", () => {
		const categoryStrategyMap = [
			["429 rate limit", "retry"],
			["service unavailable 503", "retry"],
			["request timed out", "retry"],
			["ECONNRESET network error", "retry"],
			["quota exceeded: no credits", "fallback_model"],
			["empty content response", "fallback_model"],
			["thinking block error", "fallback_model"],
			["result too large overflow", "compact_and_retry"],
			["loop detected no progress", "skip_and_continue"],
			["validation error: malformed request", "user_prompt"],
		] as const;

		for (const [errorMessage, expectedStrategy] of categoryStrategyMap) {
			const classification = classifyError(errorMessage);
			const resolver = getStrategy(classification.category);
			const action = resolver({
				sessionId: "strategy-test",
				attempts: Object.freeze([]),
				currentStrategy: null,
				maxAttempts: 3,
				isRecovering: false,
				lastError: null,
			});
			expect(action.strategy).toBe(expectedStrategy);
		}
	});
});
