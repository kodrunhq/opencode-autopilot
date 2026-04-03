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

	test("has a production-ready prompt with embedded skill content", () => {
		expect(typeof debuggerAgent.prompt).toBe("string");
		expect(debuggerAgent.prompt?.length).toBeGreaterThanOrEqual(100);
	});

	test("prompt references systematic debugging methodology", () => {
		const prompt = (debuggerAgent.prompt ?? "").toLowerCase();
		expect(prompt.includes("reproduce") || prompt.includes("hypothesis")).toBe(true);
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
