import { describe, expect, test } from "bun:test";
import { reviewerAgent } from "../../src/agents/reviewer";

describe("reviewer agent config", () => {
	test("mode is all (Tab-cycleable primary agent)", () => {
		expect(reviewerAgent.mode).toBe("all");
	});

	test("has a non-empty description", () => {
		expect(typeof reviewerAgent.description).toBe("string");
		expect(reviewerAgent.description?.length).toBeGreaterThan(0);
	});

	test("has a production-ready prompt with embedded skill content", () => {
		expect(typeof reviewerAgent.prompt).toBe("string");
		expect(reviewerAgent.prompt?.length).toBeGreaterThanOrEqual(100);
	});

	test("prompt references oc_review tool and review-only constraint", () => {
		const prompt = (reviewerAgent.prompt ?? "").toLowerCase();
		expect(prompt.includes("oc_review")).toBe(true);
		expect(prompt.includes("you do not fix")).toBe(true);
	});

	test("permissions match D-09: edit=deny, bash=allow, webfetch=deny", () => {
		expect(reviewerAgent.permission).toEqual({
			edit: "deny",
			bash: "allow",
			webfetch: "deny",
		});
	});

	test("maxSteps is set", () => {
		expect(reviewerAgent.maxSteps).toBe(30);
	});

	test("is frozen (immutable)", () => {
		expect(Object.isFrozen(reviewerAgent)).toBe(true);
	});
});
