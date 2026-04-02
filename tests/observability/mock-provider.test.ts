import { describe, expect, test } from "bun:test";
import {
	classifyErrorType,
	isRetryableError,
} from "../../src/orchestrator/fallback/error-classifier";
import { createMockError } from "../../src/observability/mock/mock-provider";
import { FAILURE_MODES } from "../../src/observability/mock/types";
import type { MockFailureMode, MockProviderConfig } from "../../src/observability/mock/types";

const DEFAULT_RETRY_CODES: readonly number[] = [429, 503, 529];

describe("MockFailureMode types", () => {
	test("FAILURE_MODES contains all 5 failure modes", () => {
		expect(FAILURE_MODES).toHaveLength(5);
		expect(FAILURE_MODES).toContain("rate_limit");
		expect(FAILURE_MODES).toContain("quota_exceeded");
		expect(FAILURE_MODES).toContain("timeout");
		expect(FAILURE_MODES).toContain("malformed");
		expect(FAILURE_MODES).toContain("service_unavailable");
	});

	test("FAILURE_MODES is frozen (immutable)", () => {
		expect(Object.isFrozen(FAILURE_MODES)).toBe(true);
	});
});

describe("createMockError classification", () => {
	test("rate_limit error is classified as rate_limit", () => {
		const error = createMockError("rate_limit");
		expect(classifyErrorType(error)).toBe("rate_limit");
	});

	test("quota_exceeded error is classified as quota_exceeded", () => {
		const error = createMockError("quota_exceeded");
		expect(classifyErrorType(error)).toBe("quota_exceeded");
	});

	test("timeout error is classified as service_unavailable", () => {
		const error = createMockError("timeout");
		expect(classifyErrorType(error)).toBe("service_unavailable");
	});

	test("malformed error is classified as unknown", () => {
		const error = createMockError("malformed");
		expect(classifyErrorType(error)).toBe("unknown");
	});

	test("service_unavailable error is classified as service_unavailable", () => {
		const error = createMockError("service_unavailable");
		expect(classifyErrorType(error)).toBe("service_unavailable");
	});
});

describe("createMockError retryability", () => {
	test("rate_limit error is retryable", () => {
		const error = createMockError("rate_limit");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});

	test("quota_exceeded error is retryable", () => {
		const error = createMockError("quota_exceeded");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});

	test("timeout error is retryable", () => {
		const error = createMockError("timeout");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});

	test("service_unavailable error is retryable", () => {
		const error = createMockError("service_unavailable");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});

	test("malformed error is NOT retryable", () => {
		const error = createMockError("malformed");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(false);
	});
});

describe("createMockError structure", () => {
	test("each mock error is frozen (immutable)", () => {
		for (const mode of FAILURE_MODES) {
			const error = createMockError(mode);
			expect(Object.isFrozen(error)).toBe(true);
		}
	});

	test("rate_limit error has status 429", () => {
		const error = createMockError("rate_limit") as Record<string, unknown>;
		expect(error.status).toBe(429);
		expect(error.statusCode).toBe(429);
		expect(error.name).toBe("APIError");
	});

	test("quota_exceeded error has status 402", () => {
		const error = createMockError("quota_exceeded") as Record<string, unknown>;
		expect(error.status).toBe(402);
		expect(error.statusCode).toBe(402);
	});

	test("timeout error has status 504", () => {
		const error = createMockError("timeout") as Record<string, unknown>;
		expect(error.status).toBe(504);
		expect(error.statusCode).toBe(504);
	});

	test("service_unavailable error has status 503", () => {
		const error = createMockError("service_unavailable") as Record<string, unknown>;
		expect(error.status).toBe(503);
		expect(error.statusCode).toBe(503);
	});

	test("malformed error has no status code", () => {
		const error = createMockError("malformed") as Record<string, unknown>;
		expect(error.status).toBeUndefined();
		expect(error.name).toBe("UnknownError");
	});

	test("custom message overrides default message", () => {
		const customMsg = "Custom rate limit message";
		const error = createMockError("rate_limit", customMsg) as Record<string, unknown>;
		expect(error.message).toBe(customMsg);
	});

	test("default messages are descriptive", () => {
		for (const mode of FAILURE_MODES) {
			const error = createMockError(mode) as Record<string, unknown>;
			expect(typeof error.message).toBe("string");
			expect((error.message as string).length).toBeGreaterThan(0);
		}
	});
});

describe("MockProviderConfig type", () => {
	test("config object matches interface shape", () => {
		const config: MockProviderConfig = {
			mode: "rate_limit",
			delayMs: 100,
			customMessage: "Test message",
		};
		expect(config.mode).toBe("rate_limit");
		expect(config.delayMs).toBe(100);
		expect(config.customMessage).toBe("Test message");
	});

	test("config optional fields can be omitted", () => {
		const config: MockProviderConfig = {
			mode: "timeout",
		};
		expect(config.mode).toBe("timeout");
		expect(config.delayMs).toBeUndefined();
		expect(config.customMessage).toBeUndefined();
	});
});
