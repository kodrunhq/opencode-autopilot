import { describe, expect, test } from "bun:test";
import { researcherAgent } from "../../src/agents/researcher";

describe("researcher agent config", () => {
	test("mode is subagent", () => {
		expect(researcherAgent.mode).toBe("subagent");
	});

	test("has a non-empty description", () => {
		expect(typeof researcherAgent.description).toBe("string");
		expect(researcherAgent.description!.length).toBeGreaterThan(0);
	});

	test("has a production-ready prompt with at least 100 characters", () => {
		expect(typeof researcherAgent.prompt).toBe("string");
		expect(researcherAgent.prompt!.length).toBeGreaterThanOrEqual(100);
	});

	test("prompt references webfetch capability", () => {
		const prompt = researcherAgent.prompt!.toLowerCase();
		expect(prompt.includes("webfetch") || prompt.includes("web")).toBe(true);
	});

	test("permissions match D-07: webfetch=allow, edit=deny, bash=deny", () => {
		expect(researcherAgent.permission).toEqual({
			webfetch: "allow",
			edit: "deny",
			bash: "deny",
		});
	});
});
