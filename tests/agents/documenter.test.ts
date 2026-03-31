import { describe, expect, test } from "bun:test";
import { documenterAgent } from "../../src/agents/documenter";

describe("documenter agent config", () => {
	test("mode is subagent", () => {
		expect(documenterAgent.mode).toBe("subagent");
	});

	test("has a non-empty description", () => {
		expect(typeof documenterAgent.description).toBe("string");
		expect(documenterAgent.description?.length).toBeGreaterThan(0);
	});

	test("has a production-ready prompt with at least 100 characters", () => {
		expect(typeof documenterAgent.prompt).toBe("string");
		expect(documenterAgent.prompt?.length).toBeGreaterThanOrEqual(100);
	});

	test("prompt references coding-standards or conventions", () => {
		const prompt = (documenterAgent.prompt ?? "").toLowerCase();
		expect(prompt.includes("coding-standards") || prompt.includes("conventions")).toBe(true);
	});

	test("permissions match D-09: edit=allow, bash=deny, webfetch=deny", () => {
		expect(documenterAgent.permission).toEqual({
			edit: "allow",
			bash: "deny",
			webfetch: "deny",
		});
	});
});
