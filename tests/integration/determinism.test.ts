import { describe, expect, test } from "bun:test";
import { selectAgents } from "../../src/review/selection";
import { advancePipeline } from "../../src/review/pipeline";
import { parseAgentFindings } from "../../src/review/parse-findings";

describe("Determinism Integration Test (Task 8)", () => {
	test("Running exactly the same setup produces exactly the same outcomes 3 times", () => {
		const seed = "integration-seed-xyz";

		function runCycle() {
			// 1. Agent Selection
			const candidateAgents = [
				{ name: "a", prompt: "p", relevantStacks: ["react"] },
				{ name: "b", prompt: "p", relevantStacks: ["node"] },
				{ name: "c", prompt: "p", relevantStacks: ["node"] },
				{ name: "d", prompt: "p", relevantStacks: [] }, // universal
			];

			const selection = selectAgents(
				["node"],
				{ hasTests: true, hasAuth: true, hasConfig: true, fileCount: 1 },
				candidateAgents,
				{ seed, limit: 1 },
			);

			// 2. Mock Agent Findings
			const rawLLMResponse = `
			\`\`\`json
			{
				"findings": [
					{
						"severity": "CRITICAL",
						"problem": "Bad code",
						"extra": "will be dropped"
					}
				]
			}
			\`\`\`
			`;

			const findings = parseAgentFindings(rawLLMResponse, selection.selected[0].name);

			// 3. Advance Pipeline
			const initialState = {
				stage: 1,
				scope: "test-scope",
				selectedAgentNames: selection.selected.map((a) => a.name),
				accumulatedFindings: [],
				startedAt: "2026-01-01T00:00:00.000Z",
			};

			const stage2Result = advancePipeline(JSON.stringify(findings), initialState as any);

			return {
				selectionNames: selection.selected.map((a) => a.name),
				findingsJson: JSON.stringify(findings),
				stage2Json: JSON.stringify(stage2Result),
			};
		}

		const run1 = runCycle();
		const run2 = runCycle();
		const run3 = runCycle();

		expect(run1).toEqual(run2);
		expect(run2).toEqual(run3);
	});
});
