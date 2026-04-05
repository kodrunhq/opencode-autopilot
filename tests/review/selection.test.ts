import { describe, expect, test } from "bun:test";
import { selectAgents } from "../../src/review/selection";

describe("selectAgents (Task 6)", () => {
	const agents = [
		{ name: "a", prompt: "", relevantStacks: [] },
		{ name: "b", prompt: "", relevantStacks: ["node"] },
		{ name: "c", prompt: "", relevantStacks: ["node"] },
		{ name: "d", prompt: "", relevantStacks: ["node"] },
		{ name: "e", prompt: "", relevantStacks: ["python"] }, // excluded
	];
	const diffAnalysis = { hasTests: false, hasAuth: false, hasConfig: false, fileCount: 1 };
	const stacks = ["node"];

	test("seed ensures identical selection order", () => {
		const result1 = selectAgents(stacks, diffAnalysis, agents, { seed: "my-test-seed" });
		const result2 = selectAgents(stacks, diffAnalysis, agents, { seed: "my-test-seed" });

		const names1 = result1.selected.map((a) => a.name);
		const names2 = result2.selected.map((a) => a.name);

		expect(names1).toEqual(names2);
		expect(result1.excluded.map((e) => e.agent)).toEqual(["e"]);
	});

	test("different seed produces different order", () => {
		const result1 = selectAgents(stacks, diffAnalysis, agents, { seed: "seed-one" });
		const result2 = selectAgents(stacks, diffAnalysis, agents, { seed: "seed-two" });

		const names1 = result1.selected.map((a) => a.name);
		const names2 = result2.selected.map((a) => a.name);

		expect(names1).not.toEqual(names2);
	});

	test("limit correctly caps the number of gated agents", () => {
		const result = selectAgents(stacks, diffAnalysis, agents, { seed: "seed", limit: 2 });
		// Universal (a) + 2 gated (b,c,d) = 3 total
		expect(result.selected.length).toBe(3);
		expect(result.excluded.map((e) => e.agent)).toContain("e"); // Stack gate
		expect(result.excluded.length).toBe(2); // One from stack gate, one from limit
	});
});
