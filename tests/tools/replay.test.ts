import { describe, expect, test } from "bun:test";
import { ocReplay } from "../../src/tools/replay";

describe("oc_replay tool (Task 7)", () => {
	test("replays inputs deterministically", async () => {
		const args = {
			runId: "test-seed",
			inputs: [
				JSON.stringify([
					{
						agent: "logic-auditor",
						severity: "CRITICAL",
						domain: "logic",
						title: "Test",
						file: "a.js",
						source: "phase1",
						evidence: "x",
						problem: "y",
						fix: "z",
					},
				]),
			],
		};

		const context = { toolCallId: "1", messages: [] } as unknown as Parameters<
			typeof ocReplay.execute
		>[1];
		const res1 = await ocReplay.execute(args, context);
		const res2 = await ocReplay.execute(args, {
			...context,
			toolCallId: "2",
		} as unknown as Parameters<typeof ocReplay.execute>[1]);

		expect(res1).toBe(res2); // string output should be identical
	});
});
