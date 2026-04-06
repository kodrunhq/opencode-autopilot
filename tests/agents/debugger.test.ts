import { describe, expect, test } from "bun:test";
import { debuggerAgent } from "../../src/agents/debugger";

describe("debugger agent config", () => {
	test("mode is all (Tab-cycleable primary agent)", () => {
		expect(debuggerAgent.mode).toBe("all");
	});

	test("has a non-empty description", () => {
		expect(typeof debuggerAgent.description).toBe("string");
		expect(debuggerAgent.description?.length).toBeGreaterThan(0);
	});

	test("has a production-ready prompt", () => {
		expect(typeof debuggerAgent.prompt).toBe("string");
		expect(debuggerAgent.prompt?.length).toBeGreaterThanOrEqual(100);
	});

	test("prompt references all four systematic debugging phases", () => {
		const prompt = (debuggerAgent.prompt ?? "").toLowerCase();
		expect(prompt.includes("reproduce")).toBe(true);
		expect(prompt.includes("isolate")).toBe(true);
		expect(prompt.includes("diagnose")).toBe(true);
		expect(prompt.includes("fix")).toBe(true);
	});

	test("permissions match D-07: edit=allow, bash=allow, webfetch=deny", () => {
		expect(debuggerAgent.permission).toEqual({
			edit: "allow",
			bash: "allow",
			webfetch: "deny",
		});
	});

	test("maxSteps is set", () => {
		expect(debuggerAgent.maxSteps).toBe(25);
	});

	test("is frozen (immutable)", () => {
		expect(Object.isFrozen(debuggerAgent)).toBe(true);
	});
});
