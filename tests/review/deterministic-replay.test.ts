import { describe, expect, test } from "bun:test";
import { advancePipeline } from "../../src/review/pipeline";
import type { ReviewState } from "../../src/review/types";

describe("Deterministic Replay (Task 3)", () => {
	const initialScope = "function auth(user) { return true; }";

	const createInitialState = (): ReviewState => ({
		stage: 1,
		scope: initialScope,
		selectedAgentNames: ["security-auditor", "auth-flow-verifier"],
		accumulatedFindings: [],
		startedAt: "2026-01-01T00:00:00.000Z",
	});

	const stage1Inputs = [
		`
		Here is my review:
		\`\`\`json
		{
			"findings": [
				{
					"agent": "security-auditor",
					"file": "auth.ts",
					"line": 1,
					"severity": "CRITICAL",
					"category": "security",
					"description": "Auth is always true"
				}
			]
		}
		\`\`\`
		`,
		`
		[
			{
				"agent": "auth-flow-verifier",
				"file": "auth.ts",
				"line": 1,
				"severity": "CRITICAL",
				"category": "security",
				"description": "Broken auth",
				"extraFieldShouldBeRemoved": true
			}
		]
		`,
	];

	function runFullPipeline(state: ReviewState, inputs: string[]) {
		const results = [];
		let currentState = state;
		for (const input of inputs) {
			const res = advancePipeline(input, currentState);
			results.push(res);
			if (res.state) {
				currentState = res.state;
			}
		}
		return results;
	}

	test("pipeline replay is 100% deterministic", () => {
		const run1 = runFullPipeline(createInitialState(), stage1Inputs);
		const run2 = runFullPipeline(createInitialState(), stage1Inputs);
		const run3 = runFullPipeline(createInitialState(), stage1Inputs);

		// Output of stringify must be identical
		expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
		expect(JSON.stringify(run2)).toBe(JSON.stringify(run3));

		// Deep equality
		expect(run1).toEqual(run2);
		expect(run2).toEqual(run3);
	});
});
