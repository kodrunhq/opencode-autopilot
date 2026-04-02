import { describe, expect, test } from "bun:test";
import { FAILURE_MODES } from "../../src/observability/mock/types";
import { mockFallbackCore } from "../../src/tools/mock-fallback";

describe("mockFallbackCore", () => {
	test("list mode returns all available failure modes", async () => {
		const result = JSON.parse(await mockFallbackCore("list"));

		expect(result.action).toBe("mock_fallback_list");
		expect(result.modes).toEqual([...FAILURE_MODES]);
		expect(typeof result.displayText).toBe("string");
		expect(result.displayText).toContain("rate_limit");
		expect(result.displayText).toContain("service_unavailable");
	});

	test("invalid mode returns error JSON", async () => {
		const result = JSON.parse(await mockFallbackCore("nonexistent_mode"));

		expect(result.action).toBe("error");
		expect(result.message).toContain("Invalid failure mode");
		expect(result.message).toContain("list");
	});

	test("rate_limit mode returns classified error info", async () => {
		const result = JSON.parse(await mockFallbackCore("rate_limit"));

		expect(result.action).toBe("mock_fallback");
		expect(result.mode).toBe("rate_limit");
		expect(result.classification).toBe("rate_limit");
		expect(result.retryable).toBe(true);
		expect(typeof result.displayText).toBe("string");
		expect(result.displayText).toContain("rate_limit");
		expect(result.displayText).toContain("Classification:");
		expect(result.displayText).toContain("Retryable:");
	});

	test("quota_exceeded mode returns classified error info", async () => {
		const result = JSON.parse(await mockFallbackCore("quota_exceeded"));

		expect(result.action).toBe("mock_fallback");
		expect(result.mode).toBe("quota_exceeded");
		expect(result.classification).toBe("quota_exceeded");
		expect(result.retryable).toBe(true);
	});

	test("timeout mode is classified as service_unavailable", async () => {
		const result = JSON.parse(await mockFallbackCore("timeout"));

		expect(result.action).toBe("mock_fallback");
		expect(result.mode).toBe("timeout");
		expect(result.classification).toBe("service_unavailable");
		expect(result.retryable).toBe(true);
	});

	test("malformed mode is classified as unknown and not retryable", async () => {
		const result = JSON.parse(await mockFallbackCore("malformed"));

		expect(result.action).toBe("mock_fallback");
		expect(result.mode).toBe("malformed");
		expect(result.classification).toBe("unknown");
		expect(result.retryable).toBe(false);
	});

	test("service_unavailable mode returns classified error info", async () => {
		const result = JSON.parse(await mockFallbackCore("service_unavailable"));

		expect(result.action).toBe("mock_fallback");
		expect(result.mode).toBe("service_unavailable");
		expect(result.classification).toBe("service_unavailable");
		expect(result.retryable).toBe(true);
	});

	test("error object fields are included in response", async () => {
		const result = JSON.parse(await mockFallbackCore("rate_limit"));

		expect(result.error).toBeDefined();
		expect(result.error.name).toBe("APIError");
		expect(result.error.message).toBeDefined();
		expect(result.error.status).toBe(429);
	});

	test("malformed error object has no status", async () => {
		const result = JSON.parse(await mockFallbackCore("malformed"));

		expect(result.error).toBeDefined();
		expect(result.error.name).toBe("UnknownError");
		expect(result.error.status).toBeUndefined();
	});

	test("displayText includes fallback testing guidance", async () => {
		const result = JSON.parse(await mockFallbackCore("rate_limit"));

		expect(result.displayText).toContain("Mock");
		expect(result.displayText).toContain("error generated");
	});

	test("all failure modes produce valid results", async () => {
		for (const mode of FAILURE_MODES) {
			const result = JSON.parse(await mockFallbackCore(mode));
			expect(result.action).toBe("mock_fallback");
			expect(result.mode).toBe(mode);
			expect(typeof result.classification).toBe("string");
			expect(typeof result.retryable).toBe("boolean");
			expect(typeof result.displayText).toBe("string");
		}
	});
});
