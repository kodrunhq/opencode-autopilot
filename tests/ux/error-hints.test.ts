import { describe, expect, test } from "bun:test";
import { getRemediationHint } from "../../src/ux/error-hints";

describe("getRemediationHint", () => {
	test("matches known remediation patterns", () => {
		expect(getRemediationHint("429 too many requests")).toBe("Rate limited. Will retry in 30s.");
		expect(getRemediationHint("context window exceeded")).toBe(
			"Context window exceeded. Try compacting conversation.",
		);
		expect(getRemediationHint("unauthorized request")).toBe(
			"Authentication failed. Check your API key.",
		);
		expect(getRemediationHint("request timeout")).toBe(
			"Request timed out. Will retry with longer timeout.",
		);
		expect(getRemediationHint("empty content from model")).toBe(
			"Model returned empty response. Retrying with different model.",
		);
		expect(getRemediationHint(new Error("SQLITE_BUSY: database is locked"))).toBe(
			"Database busy. Retrying with backoff.",
		);
	});

	test("returns null for unknown errors", () => {
		expect(getRemediationHint("something unexpected happened")).toBeNull();
	});
});
