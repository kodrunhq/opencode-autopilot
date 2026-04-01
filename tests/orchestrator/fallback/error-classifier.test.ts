import { describe, expect, test } from "bun:test";
import {
	classifyErrorType,
	extractStatusCode,
	getErrorMessage,
	isRetryableError,
	RETRYABLE_ERROR_PATTERNS,
} from "../../../src/orchestrator/fallback/error-classifier";

const DEFAULT_RETRY_CODES = [401, 402, 429, 500, 502, 503, 504];

describe("isRetryableError", () => {
	test("returns true for error with status 429", () => {
		const error = { status: 429, message: "too many requests" };
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});

	test("returns true for error message containing 'rate limit exceeded'", () => {
		const error = new Error("rate limit exceeded");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});

	test("returns true for error message containing 'service unavailable'", () => {
		const error = new Error("service unavailable");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});

	test("returns true for error message containing 'quota exceeded'", () => {
		const error = new Error("quota exceeded");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});

	test("returns false for error message 'invalid request body'", () => {
		const error = new Error("invalid request body");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(false);
	});

	test("returns true for user-provided custom pattern match", () => {
		const error = new Error("custom_gateway_timeout happened");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES, ["custom_gateway"])).toBe(true);
	});

	test("ignores invalid user regex patterns gracefully", () => {
		const error = new Error("some normal error");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES, ["[invalid"])).toBe(false);
	});

	test("returns true for missing_api_key errors", () => {
		const error = new Error("api key is missing");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});

	test("returns true for model_not_found errors", () => {
		const error = new Error("model not found");
		expect(isRetryableError(error, DEFAULT_RETRY_CODES)).toBe(true);
	});
});

describe("classifyErrorType", () => {
	test("returns 'missing_api_key' for missing key errors", () => {
		expect(classifyErrorType(new Error("api key is missing"))).toBe("missing_api_key");
		expect(classifyErrorType(new Error("No API key provided"))).toBe("missing_api_key");
	});

	test("returns 'model_not_found' for model-not-found errors", () => {
		expect(classifyErrorType(new Error("model gpt-5 not found"))).toBe("model_not_found");
		expect(classifyErrorType(new Error("The model `gpt-5` does not exist"))).toBe(
			"model_not_found",
		);
	});

	test("returns 'rate_limit' for 429 errors", () => {
		expect(classifyErrorType({ status: 429, message: "rate limited" })).toBe("rate_limit");
		expect(classifyErrorType(new Error("rate limit exceeded"))).toBe("rate_limit");
	});

	test("returns 'quota_exceeded' for quota errors", () => {
		expect(classifyErrorType(new Error("quota exceeded"))).toBe("quota_exceeded");
	});

	test("returns 'service_unavailable' for unavailable errors", () => {
		expect(classifyErrorType(new Error("service unavailable"))).toBe("service_unavailable");
	});

	test("returns 'content_filter' for content filter errors", () => {
		expect(classifyErrorType(new Error("content filter triggered"))).toBe("content_filter");
	});

	test("returns 'context_length' for context length errors", () => {
		expect(classifyErrorType(new Error("context length exceeded"))).toBe("context_length");
	});

	test("returns 'unknown' for unclassified errors", () => {
		expect(classifyErrorType(new Error("something weird happened"))).toBe("unknown");
		expect(classifyErrorType("just a string")).toBe("unknown");
	});
});

describe("extractStatusCode", () => {
	test("extracts number from error.status property", () => {
		expect(extractStatusCode({ status: 429 }, DEFAULT_RETRY_CODES)).toBe(429);
	});

	test("extracts number from error.statusCode property", () => {
		expect(extractStatusCode({ statusCode: 503 }, DEFAULT_RETRY_CODES)).toBe(503);
	});

	test("extracts number from error message text like '429'", () => {
		expect(extractStatusCode(new Error("Error 429 occurred"), DEFAULT_RETRY_CODES)).toBe(429);
	});

	test("returns null for non-matching status codes", () => {
		expect(extractStatusCode(new Error("Error 200 ok"), DEFAULT_RETRY_CODES)).toBeNull();
	});

	test("returns null for errors without status info", () => {
		expect(extractStatusCode(new Error("generic error"), DEFAULT_RETRY_CODES)).toBeNull();
	});
});

describe("getErrorMessage", () => {
	test("extracts string from Error object", () => {
		expect(getErrorMessage(new Error("test error"))).toBe("test error");
	});

	test("extracts string from nested error.error.message", () => {
		expect(getErrorMessage({ error: { message: "nested msg" } })).toBe("nested msg");
	});

	test("extracts string from error.error when it is a string", () => {
		expect(getErrorMessage({ error: "flat error string" })).toBe("flat error string");
	});

	test("handles plain string errors", () => {
		expect(getErrorMessage("just a string error")).toBe("just a string error");
	});

	test("returns empty string for null/undefined", () => {
		expect(getErrorMessage(null)).toBe("");
		expect(getErrorMessage(undefined)).toBe("");
	});
});

describe("RETRYABLE_ERROR_PATTERNS", () => {
	test("is a frozen array of RegExp", () => {
		expect(Object.isFrozen(RETRYABLE_ERROR_PATTERNS)).toBe(true);
		expect(RETRYABLE_ERROR_PATTERNS.length).toBeGreaterThan(0);
		for (const pattern of RETRYABLE_ERROR_PATTERNS) {
			expect(pattern).toBeInstanceOf(RegExp);
		}
	});
});
