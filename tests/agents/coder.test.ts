import { describe, expect, test } from "bun:test";
import { coderAgent } from "../../src/agents/coder";
import { agents } from "../../src/agents/index";

describe("coder agent config", () => {
	test("mode is all (Tab-cycleable primary agent)", () => {
		expect(coderAgent.mode).toBe("all");
	});

	test("has a non-empty description", () => {
		expect(typeof coderAgent.description).toBe("string");
		expect(coderAgent.description?.length).toBeGreaterThan(0);
	});

	test("prompt contains skill name=tdd-workflow tag", () => {
		const prompt = coderAgent.prompt ?? "";
		expect(prompt).toContain('<skill name="tdd-workflow">');
	});

	test("prompt contains skill name=coding-standards tag", () => {
		const prompt = coderAgent.prompt ?? "";
		expect(prompt).toContain('<skill name="coding-standards">');
	});

	test("permissions: edit=allow, bash=allow", () => {
		expect(coderAgent.permission?.edit).toBe("allow");
		expect(coderAgent.permission?.bash).toBe("allow");
	});

	test("permissions: webfetch is undefined or deny", () => {
		const webfetch = coderAgent.permission?.webfetch;
		expect(webfetch === undefined || webfetch === "deny").toBe(true);
	});

	test("is frozen (immutable)", () => {
		expect(Object.isFrozen(coderAgent)).toBe(true);
	});

	test("agents map has coder key", () => {
		expect("coder" in agents).toBe(true);
	});

	test("agents map keys are in alphabetical order", () => {
		const keys = Object.keys(agents);
		const sorted = [...keys].sort();
		expect(keys).toEqual(sorted);
	});
});
