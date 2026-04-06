import { describe, expect, test } from "bun:test";
import { plannerAgent } from "../../src/agents/planner";

describe("planner agent config", () => {
	test("mode is all (Tab-cycleable primary agent)", () => {
		expect(plannerAgent.mode).toBe("all");
	});

	test("has a non-empty description", () => {
		expect(typeof plannerAgent.description).toBe("string");
		expect(plannerAgent.description?.length).toBeGreaterThan(0);
	});

	test("has a production-ready prompt", () => {
		expect(typeof plannerAgent.prompt).toBe("string");
		expect(plannerAgent.prompt?.length).toBeGreaterThanOrEqual(100);
	});

	test("prompt references plan-writing concepts", () => {
		const prompt = (plannerAgent.prompt ?? "").toLowerCase();
		expect(prompt.includes("wave")).toBe(true);
		expect(prompt.includes("task")).toBe(true);
		expect(prompt.includes("plan-writing")).toBe(true);
	});

	test("permissions match D-08: edit=allow, bash=allow, webfetch=deny", () => {
		expect(plannerAgent.permission).toEqual({
			edit: "allow",
			bash: "allow",
			webfetch: "deny",
		});
	});

	test("maxSteps is set", () => {
		expect(plannerAgent.maxSteps).toBe(20);
	});

	test("is frozen (immutable)", () => {
		expect(Object.isFrozen(plannerAgent)).toBe(true);
	});
});
