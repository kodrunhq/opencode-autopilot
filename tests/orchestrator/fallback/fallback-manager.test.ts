import { describe, expect, test } from "bun:test";
import type { FallbackConfig } from "../../../src/orchestrator/fallback/fallback-config";
import { FallbackManager } from "../../../src/orchestrator/fallback/fallback-manager";
import type { FallbackPlan } from "../../../src/orchestrator/fallback/types";

const DEFAULT_CONFIG: FallbackConfig = {
	enabled: true,
	retryOnErrors: [401, 402, 429, 500, 502, 503, 504],
	retryableErrorPatterns: [],
	maxFallbackAttempts: 10,
	cooldownSeconds: 60,
	timeoutSeconds: 30,
	notifyOnFallback: true,
};

const FALLBACK_CHAIN = ["openai/gpt-4", "anthropic/claude-sonnet-4-5"];

function createManager(
	overrides?: Partial<FallbackConfig>,
	chainOverride?: readonly string[],
): FallbackManager {
	const config = { ...DEFAULT_CONFIG, ...overrides };
	return new FallbackManager({
		config,
		resolveFallbackChain: () => chainOverride ?? FALLBACK_CHAIN,
	});
}

describe("FallbackManager", () => {
	describe("session lifecycle", () => {
		test("initSession creates fallback state for a session", () => {
			const manager = createManager();
			manager.initSession("sess-1", "anthropic/claude-sonnet-4-5");
			const state = manager.getSessionState("sess-1");
			expect(state).toBeDefined();
			expect(state?.originalModel).toBe("anthropic/claude-sonnet-4-5");
			expect(state?.currentModel).toBe("anthropic/claude-sonnet-4-5");
			expect(state?.fallbackIndex).toBe(-1);
			expect(state?.attemptCount).toBe(0);
		});

		test("getSessionState returns undefined for unknown session", () => {
			const manager = createManager();
			expect(manager.getSessionState("unknown")).toBeUndefined();
		});

		test("cleanupSession removes all tracking state", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");
			manager.recordSelfAbort("sess-1");
			manager.markAwaitingResult("sess-1");
			manager.markCompactionInFlight("sess-1");
			manager.cleanupSession("sess-1");
			expect(manager.getSessionState("sess-1")).toBeUndefined();
			expect(manager.isDispatchInFlight("sess-1")).toBe(false);
			expect(manager.isSelfAbortError("sess-1")).toBe(false);
			expect(manager.isCompactionInFlight("sess-1")).toBe(false);
			expect(manager.getParentID("sess-1")).toBeUndefined();
		});

		test("cleanupSession is a no-op for unknown sessions", () => {
			const manager = createManager();
			// Should not throw
			manager.cleanupSession("unknown");
		});

		test("initSession records parentID when provided", () => {
			const manager = createManager();
			manager.initSession("child-1", "model-a", "parent-1");
			expect(manager.getParentID("child-1")).toBe("parent-1");
		});

		test("initSession records null parentID when null provided", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a", null);
			expect(manager.getParentID("sess-1")).toBeNull();
		});

		test("handleError passes stored agentName to resolveFallbackChain", () => {
			let capturedAgentName: string | undefined;
			const manager = new FallbackManager({
				config: DEFAULT_CONFIG,
				resolveFallbackChain: (_sid, agentName) => {
					capturedAgentName = agentName;
					return FALLBACK_CHAIN;
				},
			});
			manager.initSession("sess-1", "model-a", undefined, "oc-researcher");
			manager.handleError("sess-1", { status: 429, message: "rate limited" });
			expect(capturedAgentName).toBe("oc-researcher");
		});

		test("handleError passes undefined agentName when none stored", () => {
			let capturedAgentName: string | undefined = "should-be-overwritten";
			const manager = new FallbackManager({
				config: DEFAULT_CONFIG,
				resolveFallbackChain: (_sid, agentName) => {
					capturedAgentName = agentName;
					return FALLBACK_CHAIN;
				},
			});
			manager.initSession("sess-1", "model-a");
			manager.handleError("sess-1", { status: 429, message: "rate limited" });
			expect(capturedAgentName).toBeUndefined();
		});
	});

	describe("concurrency guards", () => {
		test("acquireRetryLock returns true on first call", () => {
			const manager = createManager();
			expect(manager.acquireRetryLock("sess-1")).toBe(true);
		});

		test("acquireRetryLock returns false on second call (lock held)", () => {
			const manager = createManager();
			manager.acquireRetryLock("sess-1");
			expect(manager.acquireRetryLock("sess-1")).toBe(false);
		});

		test("releaseRetryLock allows subsequent acquireRetryLock", () => {
			const manager = createManager();
			manager.acquireRetryLock("sess-1");
			manager.releaseRetryLock("sess-1");
			expect(manager.acquireRetryLock("sess-1")).toBe(true);
		});

		test("isDispatchInFlight returns true while retry lock is held", () => {
			const manager = createManager();
			expect(manager.isDispatchInFlight("sess-1")).toBe(false);
			manager.acquireRetryLock("sess-1");
			expect(manager.isDispatchInFlight("sess-1")).toBe(true);
		});

		test("isDispatchInFlight returns true while awaiting result", () => {
			const manager = createManager();
			manager.markAwaitingResult("sess-1");
			expect(manager.isDispatchInFlight("sess-1")).toBe(true);
			manager.clearAwaitingResult("sess-1");
			expect(manager.isDispatchInFlight("sess-1")).toBe(false);
		});
	});

	describe("self-abort suppression", () => {
		test("isSelfAbortError returns true within 2000ms of recordSelfAbort", () => {
			const manager = createManager();
			manager.recordSelfAbort("sess-1");
			// Immediately after recording, should be within window
			expect(manager.isSelfAbortError("sess-1")).toBe(true);
		});

		test("isSelfAbortError returns false when no self-abort was recorded", () => {
			const manager = createManager();
			expect(manager.isSelfAbortError("sess-1")).toBe(false);
		});

		test("isSelfAbortError returns false after 2000ms window expires", () => {
			const manager = createManager();
			const originalNow = Date.now;
			const baseTime = originalNow.call(Date);

			// Record self-abort at baseTime
			Date.now = () => baseTime;
			manager.recordSelfAbort("sess-1");

			// Within window — should return true (and consume the timestamp)
			Date.now = () => baseTime + 1000;
			expect(manager.isSelfAbortError("sess-1")).toBe(true);

			// Re-record for the expiry test
			Date.now = () => baseTime + 1500;
			manager.recordSelfAbort("sess-1");

			// After 2000ms from re-record — should return false
			Date.now = () => baseTime + 1500 + 2001;
			expect(manager.isSelfAbortError("sess-1")).toBe(false);

			Date.now = originalNow;
		});
	});

	describe("stale error suppression", () => {
		test("isStaleError returns true when errorModel is in failedModels and differs from current", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");

			// Trigger a fallback so model-a becomes a failed model
			const plan: FallbackPlan = {
				failedModel: "model-a",
				newModel: "openai/gpt-4",
				newFallbackIndex: 0,
				reason: "test fallback",
			};
			manager.commitAndUpdateState("sess-1", plan);

			// Now model-a is in failedModels and currentModel is openai/gpt-4
			expect(manager.isStaleError("sess-1", "model-a")).toBe(true);
		});

		test("isStaleError returns false when errorModel matches currentModel", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");
			expect(manager.isStaleError("sess-1", "model-a")).toBe(false);
		});

		test("isStaleError returns false when no errorModel provided", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");
			expect(manager.isStaleError("sess-1")).toBe(false);
		});

		test("isStaleError returns false when session unknown", () => {
			const manager = createManager();
			expect(manager.isStaleError("unknown", "model-a")).toBe(false);
		});
	});

	describe("TTFT timeout", () => {
		test("startTtftTimeout calls callback after timeoutSeconds", async () => {
			let called = false;
			const manager = createManager({ timeoutSeconds: 0.05 }); // 50ms
			manager.startTtftTimeout("sess-1", () => {
				called = true;
			});
			// Wait for timeout
			await new Promise((resolve) => setTimeout(resolve, 80));
			expect(called).toBe(true);
		});

		test("recordFirstToken cancels the TTFT timer", async () => {
			let called = false;
			const manager = createManager({ timeoutSeconds: 0.05 }); // 50ms
			manager.startTtftTimeout("sess-1", () => {
				called = true;
			});
			// Record first token before timeout fires
			manager.recordFirstToken("sess-1");
			await new Promise((resolve) => setTimeout(resolve, 80));
			expect(called).toBe(false);
		});

		test("cleanupSession cancels pending TTFT timer", async () => {
			let called = false;
			const manager = createManager({ timeoutSeconds: 0.05 }); // 50ms
			manager.startTtftTimeout("sess-1", () => {
				called = true;
			});
			manager.cleanupSession("sess-1");
			await new Promise((resolve) => setTimeout(resolve, 80));
			expect(called).toBe(false);
		});

		test("startTtftTimeout replaces existing timeout", async () => {
			let firstCalled = false;
			let secondCalled = false;
			const manager = createManager({ timeoutSeconds: 0.05 }); // 50ms
			manager.startTtftTimeout("sess-1", () => {
				firstCalled = true;
			});
			// Replace with new timeout
			manager.startTtftTimeout("sess-1", () => {
				secondCalled = true;
			});
			await new Promise((resolve) => setTimeout(resolve, 80));
			expect(firstCalled).toBe(false);
			expect(secondCalled).toBe(true);
		});

		test("recordFirstToken does nothing if already received", async () => {
			let callCount = 0;
			const manager = createManager({ timeoutSeconds: 0.1 });
			manager.startTtftTimeout("sess-1", () => {
				callCount++;
			});
			manager.recordFirstToken("sess-1");
			manager.recordFirstToken("sess-1"); // Second call should be no-op
			await new Promise((resolve) => setTimeout(resolve, 150));
			expect(callCount).toBe(0);
		});
	});

	describe("handleError", () => {
		test("returns FallbackPlan for retryable error on session with fallback chain", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");
			const plan = manager.handleError("sess-1", { status: 429, message: "rate limited" });
			expect(plan).not.toBeNull();
			expect(plan?.newModel).toBe("openai/gpt-4");
		});

		test("returns null for non-retryable error", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");
			const plan = manager.handleError("sess-1", new Error("invalid request body"));
			expect(plan).toBeNull();
		});

		test("returns null when retry lock already held (Pitfall 1)", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");
			manager.acquireRetryLock("sess-1");
			const plan = manager.handleError(
				"sess-1",
				{ status: 429, message: "rate limited" },
				"model-a",
			);
			expect(plan).toBeNull();
		});

		test("returns null when error is self-abort (Pitfall 2)", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");
			manager.recordSelfAbort("sess-1");
			const plan = manager.handleError("sess-1", { status: 429, message: "rate limited" });
			expect(plan).toBeNull();
		});

		test("returns null when error model is stale (Pitfall 5)", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");

			// Trigger fallback so model-a is in failedModels
			const firstPlan = manager.handleError("sess-1", {
				status: 429,
				message: "rate limited",
			});
			expect(firstPlan).not.toBeNull();
			if (firstPlan) {
				manager.commitAndUpdateState("sess-1", firstPlan);
			}
			manager.releaseRetryLock("sess-1");

			// Now stale error from model-a arrives
			const plan = manager.handleError(
				"sess-1",
				{ status: 429, message: "rate limited" },
				"model-a",
			);
			expect(plan).toBeNull();
		});

		test("returns null when session is unknown", () => {
			const manager = createManager();
			const plan = manager.handleError("unknown", { status: 429, message: "rate limited" });
			expect(plan).toBeNull();
		});

		test("two concurrent handleError calls - only first returns a plan", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");

			const plan1 = manager.handleError("sess-1", {
				status: 429,
				message: "rate limited",
			});
			const plan2 = manager.handleError("sess-1", {
				status: 503,
				message: "service unavailable",
			});

			expect(plan1).not.toBeNull();
			expect(plan2).toBeNull();
		});
	});

	describe("commitAndUpdateState", () => {
		test("applies plan to session state immutably", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");

			const plan: FallbackPlan = {
				failedModel: "model-a",
				newModel: "openai/gpt-4",
				newFallbackIndex: 0,
				reason: "test fallback",
			};

			const committed = manager.commitAndUpdateState("sess-1", plan);
			expect(committed).toBe(true);

			const state = manager.getSessionState("sess-1");
			expect(state?.currentModel).toBe("openai/gpt-4");
			expect(state?.attemptCount).toBe(1);
			expect(state?.failedModels.has("model-a")).toBe(true);
		});

		test("returns false when session is unknown", () => {
			const manager = createManager();
			const plan: FallbackPlan = {
				failedModel: "model-a",
				newModel: "model-b",
				newFallbackIndex: 0,
				reason: "test",
			};
			expect(manager.commitAndUpdateState("unknown", plan)).toBe(false);
		});
	});

	describe("tryRecoverToOriginal", () => {
		test("resets session to primary model when cooldown expired", () => {
			const manager = createManager({ cooldownSeconds: 1 }); // 1s cooldown (min valid)
			const originalNow = Date.now;
			const baseTime = originalNow.call(Date);

			manager.initSession("sess-1", "model-a");

			// First fallback — commit at baseTime
			Date.now = () => baseTime;
			const plan: FallbackPlan = {
				failedModel: "model-a",
				newModel: "openai/gpt-4",
				newFallbackIndex: 0,
				reason: "test fallback",
			};
			manager.commitAndUpdateState("sess-1", plan);

			// Advance past cooldown (1001ms > 1000ms)
			Date.now = () => baseTime + 1001;
			const recovered = manager.tryRecoverToOriginal("sess-1");
			expect(recovered).toBe(true);

			const state = manager.getSessionState("sess-1");
			expect(state?.currentModel).toBe("model-a");

			Date.now = originalNow;
		});

		test("returns false when session is unknown", () => {
			const manager = createManager();
			expect(manager.tryRecoverToOriginal("unknown")).toBe(false);
		});

		test("returns false when already on original model", () => {
			const manager = createManager();
			manager.initSession("sess-1", "model-a");
			expect(manager.tryRecoverToOriginal("sess-1")).toBe(false);
		});
	});

	describe("compaction tracking", () => {
		test("markCompactionInFlight / isCompactionInFlight / clearCompactionInFlight", () => {
			const manager = createManager();
			expect(manager.isCompactionInFlight("sess-1")).toBe(false);
			manager.markCompactionInFlight("sess-1");
			expect(manager.isCompactionInFlight("sess-1")).toBe(true);
			manager.clearCompactionInFlight("sess-1");
			expect(manager.isCompactionInFlight("sess-1")).toBe(false);
		});
	});
});
