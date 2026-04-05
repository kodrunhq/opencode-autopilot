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

describe("FallbackManager Concurrency", () => {
	test("should handle concurrent handleError calls cleanly", async () => {
		const manager = createManager();
		manager.initSession("session-123", "openai/gpt-4");

		const error = new Error("Rate limit exceeded");
		(error as any).status = 429;

		const calls = Array.from({ length: 10 }).map((_, i) => {
			return new Promise<FallbackPlan | null>((resolve) => {
				setTimeout(async () => {
					const result = manager.handleError("session-123", error, "openai/gpt-4");
					resolve(result);
				}, Math.random() * 10);
			});
		});

		const results = await Promise.all(calls);
		const successfulPlans = results.filter((r) => r !== null);

		expect(successfulPlans.length).toBe(1);
		expect(successfulPlans[0]?.newModel).toBe("anthropic/claude-sonnet-4-5");
	});
});
