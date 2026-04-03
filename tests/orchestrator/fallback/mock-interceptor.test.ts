import { describe, expect, test } from "bun:test";
import type { MockFailureMode } from "../../../src/observability/mock/types";
import { isRetryableError } from "../../../src/orchestrator/fallback/error-classifier";
import {
	createMockInterceptor,
	MockInterceptor,
} from "../../../src/orchestrator/fallback/mock-interceptor";

describe("MockInterceptor", () => {
	test("cycles through sequence deterministically", () => {
		const interceptor = new MockInterceptor(["rate_limit", "quota_exceeded"]);
		expect(interceptor.nextMode()).toBe("rate_limit");
		expect(interceptor.nextMode()).toBe("quota_exceeded");
		expect(interceptor.nextMode()).toBe("rate_limit"); // cycles
		expect(interceptor.nextMode()).toBe("quota_exceeded");
	});

	test("nextError returns a frozen error object", () => {
		const interceptor = new MockInterceptor(["rate_limit"]);
		const error = interceptor.nextError();
		expect(error).toBeDefined();
		expect(Object.isFrozen(error)).toBe(true);
	});

	test("reset restarts from index 0", () => {
		const interceptor = new MockInterceptor(["rate_limit", "quota_exceeded", "timeout"]);
		interceptor.nextMode(); // rate_limit
		interceptor.nextMode(); // quota_exceeded
		expect(interceptor.position).toBe(2);

		interceptor.reset();
		expect(interceptor.position).toBe(0);
		expect(interceptor.nextMode()).toBe("rate_limit");
	});

	test("generated mock errors pass isRetryableError (except malformed)", () => {
		const retryOnErrors = [401, 402, 429, 500, 502, 503, 504];
		const retryableModes: MockFailureMode[] = [
			"rate_limit",
			"quota_exceeded",
			"timeout",
			"service_unavailable",
		];
		for (const mode of retryableModes) {
			const interceptor = new MockInterceptor([mode]);
			const error = interceptor.nextError();
			expect(isRetryableError(error, retryOnErrors)).toBe(true);
		}

		// malformed should NOT be retryable (no matching status code or pattern)
		const malformedInterceptor = new MockInterceptor(["malformed"]);
		const malformedError = malformedInterceptor.nextError();
		expect(isRetryableError(malformedError, retryOnErrors)).toBe(false);
	});
});

describe("createMockInterceptor", () => {
	test("returns null when disabled", () => {
		const result = createMockInterceptor({ enabled: false, sequence: ["rate_limit"] });
		expect(result).toBeNull();
	});

	test("returns null when sequence is empty", () => {
		const result = createMockInterceptor({ enabled: true, sequence: [] });
		expect(result).toBeNull();
	});

	test("returns MockInterceptor when enabled with non-empty sequence", () => {
		const result = createMockInterceptor({ enabled: true, sequence: ["rate_limit", "timeout"] });
		expect(result).not.toBeNull();
		expect(result).toBeInstanceOf(MockInterceptor);
		expect(result!.nextMode()).toBe("rate_limit");
	});
});
