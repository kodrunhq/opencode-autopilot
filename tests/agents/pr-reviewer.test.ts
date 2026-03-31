import { describe, expect, test } from "bun:test";
import { prReviewerAgent } from "../../src/agents/pr-reviewer";

describe("pr-reviewer agent config", () => {
	test("mode is subagent", () => {
		expect(prReviewerAgent.mode).toBe("subagent");
	});

	test("has a non-empty description", () => {
		expect(typeof prReviewerAgent.description).toBe("string");
		expect(prReviewerAgent.description?.length).toBeGreaterThan(0);
	});

	test("has a production-ready prompt with at least 100 characters", () => {
		expect(typeof prReviewerAgent.prompt).toBe("string");
		expect(prReviewerAgent.prompt?.length).toBeGreaterThanOrEqual(100);
	});

	test("prompt references git or gh commands", () => {
		const prompt = prReviewerAgent.prompt?.toLowerCase();
		expect(prompt.includes("git") || prompt.includes("gh")).toBe(true);
	});

	test("permissions match D-10: bash=allow, edit=deny, webfetch=deny", () => {
		expect(prReviewerAgent.permission).toEqual({
			bash: "allow",
			edit: "deny",
			webfetch: "deny",
		});
	});
});
