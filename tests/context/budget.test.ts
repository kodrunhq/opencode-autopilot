import { describe, expect, test } from "bun:test";
import { allocateBudget, truncateToTokens } from "../../src/context/budget";
import type { ContextSource } from "../../src/context/types";

function createSource(name: string, priority: number, tokenEstimate: number): ContextSource {
	return {
		name,
		filePath: `/tmp/${name}`,
		content: `${name} content`,
		priority,
		tokenEstimate,
	};
}

describe("allocateBudget", () => {
	test("allocates budget in priority order", () => {
		const sources = [
			createSource("readme", 50, 100),
			createSource("agents", 90, 150),
			createSource("claude", 85, 80),
		];

		const result = allocateBudget(sources, 200);

		expect(result.allocations.get("/tmp/agents")).toBe(150);
		expect(result.allocations.get("/tmp/claude")).toBe(50);
		expect(result.allocations.get("/tmp/readme")).toBe(0);
		expect(result.totalUsed).toBe(200);
	});

	test("handles budgets that exceed the total estimated tokens", () => {
		const sources = [createSource("agents", 90, 100), createSource("readme", 50, 25)];

		const result = allocateBudget(sources, 500);

		expect(result.allocations.get("/tmp/agents")).toBe(100);
		expect(result.allocations.get("/tmp/readme")).toBe(25);
		expect(result.totalUsed).toBe(125);
	});
});

describe("truncateToTokens", () => {
	test("returns the original content when within budget", () => {
		expect(truncateToTokens("abcd", 1)).toBe("abcd");
	});

	test("truncates content and appends a marker when over budget", () => {
		const truncated = truncateToTokens("abcdefghijklmnopqrstuvwxyz", 4);

		expect(truncated.endsWith("... [truncated]")).toBe(true);
		expect(truncated.length).toBeLessThanOrEqual(16);
	});
});
