import { describe, expect, it } from "bun:test";
import { getContextUtilizationString } from "../../src/observability/context-display";

describe("getContextUtilizationString", () => {
	it("formats standard utilization", () => {
		expect(getContextUtilizationString(7000, 20000)).toBe("[35% used] 7000 / 20000 tokens");
	});

	it("handles zero max tokens", () => {
		expect(getContextUtilizationString(123, 0)).toBe("[0% used] 123 / 0 tokens");
	});

	it("clamps utilization above 100 percent", () => {
		expect(getContextUtilizationString(250, 200)).toBe("[100% used] 250 / 200 tokens");
	});

	it("clamps negative values to zero", () => {
		expect(getContextUtilizationString(-50, -10)).toBe("[0% used] 0 / 0 tokens");
	});
});
