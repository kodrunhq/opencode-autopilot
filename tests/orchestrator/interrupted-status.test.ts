import { describe, expect, test } from "bun:test";
import { isAbortError } from "../../src/tools/orchestrate";

describe("isAbortError", () => {
	test("returns true for AbortError name", () => {
		const error = new Error("request failed");
		error.name = "AbortError";

		expect(isAbortError(error)).toBe(true);
	});

	test("returns true when message contains abort", () => {
		expect(isAbortError(new Error("Operation aborted by user"))).toBe(true);
	});

	test("returns true when message contains cancel", () => {
		expect(isAbortError(new Error("Pipeline was canceled by signal"))).toBe(true);
	});

	test("returns false for regular error", () => {
		expect(isAbortError(new Error("ordinary failure"))).toBe(false);
	});

	test("returns false for non-Error values", () => {
		expect(isAbortError("abort")).toBe(false);
	});
});
