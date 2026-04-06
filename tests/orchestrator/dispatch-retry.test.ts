import { afterEach, describe, expect, test } from "bun:test";
import {
	buildFailureSummary,
	clearAllRetryState,
	clearRetryState,
	decideRetry,
	detectDispatchFailure,
	getRetryState,
	recordRetryAttempt,
} from "../../src/orchestrator/dispatch-retry";

afterEach(() => {
	clearAllRetryState();
});

// ── detectDispatchFailure ─────────────────────────────────────────

describe("detectDispatchFailure", () => {
	test("returns error for empty string", () => {
		expect(detectDispatchFailure("")).toBe("empty result payload");
	});

	test("returns error for whitespace-only string", () => {
		expect(detectDispatchFailure("   ")).toBe("empty result payload");
	});

	test("detects JSON error objects with error field", () => {
		const json = JSON.stringify({ error: "provider_unavailable" });
		expect(detectDispatchFailure(json)).toBe("provider_unavailable");
	});

	test("detects JSON error objects with code field", () => {
		const json = JSON.stringify({ code: "E_TIMEOUT" });
		expect(detectDispatchFailure(json)).toBe("E_TIMEOUT");
	});

	test("detects JSON error objects with status=error", () => {
		const json = JSON.stringify({ status: "error", message: "something broke" });
		expect(detectDispatchFailure(json)).toBe("something broke");
	});

	test("returns null for valid JSON without error indicators", () => {
		const json = JSON.stringify({ result: "ok", data: { key: "value" } });
		expect(detectDispatchFailure(json)).toBeNull();
	});

	test("detects short error pattern: 502 bad gateway", () => {
		expect(detectDispatchFailure("502 bad gateway")).not.toBeNull();
	});

	test("detects short error pattern: rate limit", () => {
		expect(detectDispatchFailure("rate limit exceeded")).not.toBeNull();
	});

	test("detects short error pattern: 429", () => {
		expect(detectDispatchFailure("429")).not.toBeNull();
	});

	test("detects short error pattern: timeout", () => {
		expect(detectDispatchFailure("timeout")).not.toBeNull();
	});

	test("detects short error pattern: ECONNRESET", () => {
		expect(detectDispatchFailure("ECONNRESET")).not.toBeNull();
	});

	test("detects short error pattern: socket hang up", () => {
		expect(detectDispatchFailure("socket hang up")).not.toBeNull();
	});

	test("detects short error pattern: service unavailable", () => {
		expect(detectDispatchFailure("service unavailable")).not.toBeNull();
	});

	test("detects short error pattern: overloaded", () => {
		expect(detectDispatchFailure("overloaded")).not.toBeNull();
	});

	test("detects short error pattern: E_INVALID_RESULT", () => {
		expect(detectDispatchFailure("E_INVALID_RESULT")).not.toBeNull();
	});

	test("returns null for long legitimate content mentioning error keywords", () => {
		const longContent =
			"This is a comprehensive analysis of timeout behavior in distributed systems. " +
			"The architecture handles 502 errors gracefully through retry logic. " +
			"Rate limiting is applied at the gateway level to prevent overload. " +
			"Service availability is monitored via health checks running every 30 seconds.";
		expect(detectDispatchFailure(longContent)).toBeNull();
	});

	test("returns null for medium-length legitimate content", () => {
		const content =
			"The researcher found that the proposed architecture uses retry patterns " +
			"for handling transient failures, including 502 and 503 HTTP status codes.";
		expect(detectDispatchFailure(content)).toBeNull();
	});
});

// ── decideRetry ───────────────────────────────────────────────────

describe("decideRetry", () => {
	test("allows retry for rate_limit error on first attempt", () => {
		const decision = decideRetry("dispatch-1", "RECON", "oc-researcher", "rate limit exceeded");
		expect(decision.shouldRetry).toBe(true);
		expect(decision.errorCategory).toBe("rate_limit");
		expect(decision.backoffMs).toBeGreaterThan(0);
	});

	test("allows retry for service_unavailable error", () => {
		const decision = decideRetry(
			"dispatch-2",
			"BUILD",
			"oc-implementer",
			"503 service unavailable",
		);
		expect(decision.shouldRetry).toBe(true);
		expect(decision.errorCategory).toBe("service_unavailable");
	});

	test("allows retry for network error", () => {
		const decision = decideRetry(
			"dispatch-3",
			"RECON",
			"oc-researcher",
			"network connection reset",
		);
		expect(decision.shouldRetry).toBe(true);
		expect(decision.errorCategory).toBe("network");
	});

	test("allows retry for timeout error", () => {
		const decision = decideRetry("dispatch-4", "PLAN", "oc-planner", "request timeout");
		expect(decision.shouldRetry).toBe(true);
		expect(decision.errorCategory).toBe("timeout");
	});

	test("denies retry for auth_failure (non-recoverable)", () => {
		const decision = decideRetry("dispatch-5", "BUILD", "oc-implementer", "API key unauthorized");
		expect(decision.shouldRetry).toBe(false);
		expect(decision.errorCategory).toBe("auth_failure");
	});

	test("denies retry for session_corruption (non-recoverable)", () => {
		const decision = decideRetry(
			"dispatch-6",
			"ARCHITECT",
			"oc-architect",
			"session corrupt state mismatch",
		);
		expect(decision.shouldRetry).toBe(false);
		expect(decision.errorCategory).toBe("session_corruption");
	});

	test("denies retry when max retries exhausted", () => {
		recordRetryAttempt("dispatch-7", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-7", "RECON", "oc-researcher", "rate_limit");

		const decision = decideRetry("dispatch-7", "RECON", "oc-researcher", "rate limit exceeded", 2);
		expect(decision.shouldRetry).toBe(false);
		expect(decision.reasoning).toContain("Retry limit reached");
	});

	test("suggests fallback model after first retry", () => {
		recordRetryAttempt("dispatch-8", "BUILD", "oc-implementer", "service_unavailable");

		const decision = decideRetry(
			"dispatch-8",
			"BUILD",
			"oc-implementer",
			"503 service unavailable",
			3,
		);
		expect(decision.shouldRetry).toBe(true);
		expect(decision.useFallbackModel).toBe(true);
	});

	test("provides reasoning string", () => {
		const decision = decideRetry("dispatch-9", "RECON", "oc-researcher", "rate limit exceeded");
		expect(decision.reasoning).toBeTruthy();
		expect(typeof decision.reasoning).toBe("string");
	});

	test("uses custom maxRetries", () => {
		const decision = decideRetry("dispatch-10", "RECON", "oc-researcher", "rate limit exceeded", 5);
		expect(decision.shouldRetry).toBe(true);
	});
});

// ── retry state management ────────────────────────────────────────

describe("retry state management", () => {
	test("getRetryState returns null for unknown dispatch", () => {
		expect(getRetryState("nonexistent")).toBeNull();
	});

	test("recordRetryAttempt creates state on first call", () => {
		recordRetryAttempt("dispatch-a", "RECON", "oc-researcher", "rate_limit");

		const state = getRetryState("dispatch-a");
		expect(state).not.toBeNull();
		expect(state?.attempts).toBe(1);
		expect(state?.phase).toBe("RECON");
		expect(state?.agent).toBe("oc-researcher");
		expect(state?.lastCategory).toBe("rate_limit");
	});

	test("recordRetryAttempt increments attempts on subsequent calls", () => {
		recordRetryAttempt("dispatch-b", "BUILD", "oc-implementer", "timeout");
		recordRetryAttempt("dispatch-b", "BUILD", "oc-implementer", "service_unavailable");

		const state = getRetryState("dispatch-b");
		expect(state?.attempts).toBe(2);
		expect(state?.lastCategory).toBe("service_unavailable");
	});

	test("clearRetryState removes specific dispatch state", () => {
		recordRetryAttempt("dispatch-c", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-d", "BUILD", "oc-implementer", "timeout");

		clearRetryState("dispatch-c");

		expect(getRetryState("dispatch-c")).toBeNull();
		expect(getRetryState("dispatch-d")).not.toBeNull();
	});

	test("clearAllRetryState removes all state", () => {
		recordRetryAttempt("dispatch-e", "RECON", "oc-researcher", "rate_limit");
		recordRetryAttempt("dispatch-f", "BUILD", "oc-implementer", "timeout");

		clearAllRetryState();

		expect(getRetryState("dispatch-e")).toBeNull();
		expect(getRetryState("dispatch-f")).toBeNull();
	});

	test("state objects are frozen (immutable)", () => {
		recordRetryAttempt("dispatch-g", "RECON", "oc-researcher", "rate_limit");
		const state = getRetryState("dispatch-g");
		expect(state).not.toBeNull();
		expect(Object.isFrozen(state)).toBe(true);
	});
});

// ── buildFailureSummary ───────────────────────────────────────────

describe("buildFailureSummary", () => {
	test("includes all relevant fields", () => {
		const summary = buildFailureSummary(
			"dispatch-1",
			"RECON",
			"oc-researcher",
			"502 bad gateway",
			"service_unavailable",
			2,
		);

		expect(summary).toContain("DISPATCH_FAILED");
		expect(summary).toContain("oc-researcher");
		expect(summary).toContain("RECON");
		expect(summary).toContain("service_unavailable");
		expect(summary).toContain("dispatch-1");
		expect(summary).toContain("Attempts: 2");
		expect(summary).toContain("502 bad gateway");
	});

	test("truncates long error text to 500 chars", () => {
		const longError = "x".repeat(1000);
		const summary = buildFailureSummary(
			"dispatch-2",
			"BUILD",
			"oc-implementer",
			longError,
			"unknown",
			1,
		);

		// The error line should be truncated
		const errorLine = summary.split("\n").find((l) => l.startsWith("Error:"));
		expect(errorLine).toBeDefined();
		// "Error: " prefix + 500 chars max
		expect(errorLine?.length).toBeLessThanOrEqual(507);
	});

	test("provides actionable guidance", () => {
		const summary = buildFailureSummary(
			"dispatch-3",
			"ARCHITECT",
			"oc-architect",
			"timeout",
			"timeout",
			3,
		);

		expect(summary).toContain("orchestrator");
	});
});
