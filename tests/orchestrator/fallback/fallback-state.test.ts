import { describe, expect, test } from "bun:test";
import {
	commitFallback,
	createFallbackState,
	planFallback,
	recoverToOriginal,
} from "../../../src/orchestrator/fallback/fallback-state";
import type { FallbackPlan, FallbackState } from "../../../src/orchestrator/fallback/types";

describe("createFallbackState", () => {
	test("returns state with originalModel and currentModel set to provided model", () => {
		const state = createFallbackState("anthropic/claude-sonnet-4-5");
		expect(state.originalModel).toBe("anthropic/claude-sonnet-4-5");
		expect(state.currentModel).toBe("anthropic/claude-sonnet-4-5");
	});

	test("returns state with fallbackIndex -1 and empty failedModels", () => {
		const state = createFallbackState("openai/gpt-4");
		expect(state.fallbackIndex).toBe(-1);
		expect(state.failedModels.size).toBe(0);
		expect(state.attemptCount).toBe(0);
		expect(Object.keys(state)).not.toContain("pendingFallbackModel");
	});
});

describe("planFallback", () => {
	const chain = ["openai/gpt-4", "anthropic/claude-sonnet-4-5", "google/gemini-pro"];
	const maxAttempts = 10;
	const cooldownMs = 60_000;

	test("returns plan with next model from chain when retryable error", () => {
		const state = createFallbackState("primary/model");
		const result = planFallback(state, chain, maxAttempts, cooldownMs);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.plan.newModel).toBe("openai/gpt-4");
			expect(result.plan.failedModel).toBe("primary/model");
			expect(result.plan.newFallbackIndex).toBe(0);
		}
	});

	test("returns next available model after current fallback index", () => {
		const state: FallbackState = {
			originalModel: "primary/model",
			currentModel: "openai/gpt-4",
			fallbackIndex: 0,
			failedModels: new Map([["openai/gpt-4", Date.now()]]),
			attemptCount: 1,
		};
		const result = planFallback(state, chain, maxAttempts, cooldownMs);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.plan.newModel).toBe("anthropic/claude-sonnet-4-5");
			expect(result.plan.newFallbackIndex).toBe(1);
		}
	});

	test("returns failure when all models exhausted", () => {
		const state: FallbackState = {
			originalModel: "primary/model",
			currentModel: "google/gemini-pro",
			fallbackIndex: 2,
			failedModels: new Map([
				["openai/gpt-4", Date.now()],
				["anthropic/claude-sonnet-4-5", Date.now()],
				["google/gemini-pro", Date.now()],
			]),
			attemptCount: 3,
		};
		const result = planFallback(state, chain, maxAttempts, cooldownMs);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.reason).toContain("exhausted");
		}
	});

	test("returns failure when max attempts reached", () => {
		const state: FallbackState = {
			originalModel: "primary/model",
			currentModel: "openai/gpt-4",
			fallbackIndex: 0,
			failedModels: new Map(),
			attemptCount: 10,
		};
		const result = planFallback(state, chain, 10, cooldownMs);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.reason).toContain("attempts");
		}
	});

	test("skips models in cooldown", () => {
		const now = Date.now();
		const state: FallbackState = {
			originalModel: "primary/model",
			currentModel: "primary/model",
			fallbackIndex: -1,
			failedModels: new Map([["openai/gpt-4", now]]),
			attemptCount: 1,
		};
		const result = planFallback(state, chain, maxAttempts, cooldownMs);
		expect(result.success).toBe(true);
		if (result.success) {
			// Should skip openai/gpt-4 (in cooldown) and use the next
			expect(result.plan.newModel).toBe("anthropic/claude-sonnet-4-5");
			expect(result.plan.newFallbackIndex).toBe(1);
		}
	});

	test("uses model whose cooldown has expired", () => {
		const expiredTime = Date.now() - cooldownMs - 1;
		const state: FallbackState = {
			originalModel: "primary/model",
			currentModel: "primary/model",
			fallbackIndex: -1,
			failedModels: new Map([["openai/gpt-4", expiredTime]]),
			attemptCount: 1,
		};
		const result = planFallback(state, chain, maxAttempts, cooldownMs);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.plan.newModel).toBe("openai/gpt-4");
			expect(result.plan.newFallbackIndex).toBe(0);
		}
	});

	test("skips currentModel in fallback chain to prevent self-selection", () => {
		const chain = ["primary/model", "backup/model"];
		const state: import("../../../src/orchestrator/fallback/types").FallbackState = {
			originalModel: "primary/model",
			currentModel: "primary/model",
			fallbackIndex: -1,
			failedModels: new Map(),
			attemptCount: 0,
		};
		const result = planFallback(state, chain, 3, 60000);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.plan.newModel).toBe("backup/model");
			expect(result.plan.newModel).not.toBe(state.currentModel);
		}
	});

	test("returns failure when only currentModel is in chain", () => {
		const chain = ["primary/model"];
		const state: import("../../../src/orchestrator/fallback/types").FallbackState = {
			originalModel: "primary/model",
			currentModel: "primary/model",
			fallbackIndex: -1,
			failedModels: new Map(),
			attemptCount: 0,
		};
		const result = planFallback(state, chain, 3, 60000);
		expect(result.success).toBe(false);
	});

	test("returns failure when chain is empty", () => {
		const state: import("../../../src/orchestrator/fallback/types").FallbackState = {
			originalModel: "primary/model",
			currentModel: "primary/model",
			fallbackIndex: -1,
			failedModels: new Map(),
			attemptCount: 0,
		};
		const result = planFallback(state, [], 3, 60000);
		expect(result.success).toBe(false);
	});
});

describe("commitFallback", () => {
	test("returns new state with updated currentModel and incremented attemptCount", () => {
		const state = createFallbackState("primary/model");
		const plan: FallbackPlan = {
			failedModel: "primary/model",
			newModel: "openai/gpt-4",
			newFallbackIndex: 0,
			reason: "rate limit",
		};
		const result = commitFallback(state, plan);
		expect(result.committed).toBe(true);
		expect(result.state.currentModel).toBe("openai/gpt-4");
		expect(result.state.fallbackIndex).toBe(0);
		expect(result.state.attemptCount).toBe(1);
		expect(result.state.failedModels.has("primary/model")).toBe(true);
	});

	test("NEVER mutates input state", () => {
		const state = createFallbackState("primary/model");
		const originalModel = state.currentModel;
		const originalAttempt = state.attemptCount;
		const originalIndex = state.fallbackIndex;
		const plan: FallbackPlan = {
			failedModel: "primary/model",
			newModel: "openai/gpt-4",
			newFallbackIndex: 0,
			reason: "rate limit",
		};
		commitFallback(state, plan);
		expect(state.currentModel).toBe(originalModel);
		expect(state.attemptCount).toBe(originalAttempt);
		expect(state.fallbackIndex).toBe(originalIndex);
		expect(state.failedModels.size).toBe(0);
	});

	test("returns committed:false when currentModel != plan.failedModel (stale plan)", () => {
		const state: FallbackState = {
			originalModel: "primary/model",
			currentModel: "openai/gpt-4",
			fallbackIndex: 0,
			failedModels: new Map(),
			attemptCount: 1,
		};
		const plan: FallbackPlan = {
			failedModel: "primary/model",
			newModel: "anthropic/claude-sonnet-4-5",
			newFallbackIndex: 1,
			reason: "stale",
		};
		const result = commitFallback(state, plan);
		expect(result.committed).toBe(false);
	});
});

describe("recoverToOriginal", () => {
	const cooldownMs = 60_000;

	test("returns new state with currentModel reset when cooldown expired", () => {
		const expiredTime = Date.now() - cooldownMs - 1;
		const state: FallbackState = {
			originalModel: "primary/model",
			currentModel: "openai/gpt-4",
			fallbackIndex: 0,
			failedModels: new Map([["primary/model", expiredTime]]),
			attemptCount: 1,
		};
		const result = recoverToOriginal(state, cooldownMs);
		expect(result).not.toBeNull();
		expect(result?.currentModel).toBe("primary/model");
		expect(result?.fallbackIndex).toBe(-1);
	});

	test("returns null when cooldown not expired", () => {
		const recentTime = Date.now();
		const state: FallbackState = {
			originalModel: "primary/model",
			currentModel: "openai/gpt-4",
			fallbackIndex: 0,
			failedModels: new Map([["primary/model", recentTime]]),
			attemptCount: 1,
		};
		const result = recoverToOriginal(state, cooldownMs);
		expect(result).toBeNull();
	});

	test("returns null when already on original model", () => {
		const state = createFallbackState("primary/model");
		const result = recoverToOriginal(state, cooldownMs);
		expect(result).toBeNull();
	});

	test("returns recovered state when original model not in failedModels", () => {
		const state: FallbackState = {
			originalModel: "primary/model",
			currentModel: "openai/gpt-4",
			fallbackIndex: 0,
			failedModels: new Map(),
			attemptCount: 1,
		};
		const result = recoverToOriginal(state, cooldownMs);
		expect(result).not.toBeNull();
		expect(result?.currentModel).toBe("primary/model");
		expect(result?.fallbackIndex).toBe(-1);
	});
});
