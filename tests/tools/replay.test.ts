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

		const res1 = await ocReplay.execute(args, { toolCallId: "1", messages: [] } as any);
		const res2 = await ocReplay.execute(args, { toolCallId: "2", messages: [] } as any);

		expect(res1).toBe(res2); // string output should be identical
	});
});
