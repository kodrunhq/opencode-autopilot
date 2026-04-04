import { describe, expect, test } from "bun:test";
import { coderAgent } from "../../src/agents/coder";
import { agents } from "../../src/agents/index";

describe("coder agent config", () => {
	test("mode is all (Tab-cycleable primary agent)", () => {
		expect(coderAgent.mode).toBe("all");
	});

	test("agents map exposes coder as mode 'all'", () => {
		expect(agents.coder.mode).toBe("all");
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

	test("permissions: exact shape (edit, bash allowed; webfetch denied)", () => {
		expect(coderAgent.permission).toEqual({
			edit: "allow",
			bash: "allow",
			webfetch: "deny",
		});
	});

	test("maxSteps is 30", () => {
		expect(coderAgent.maxSteps).toBe(30);
	});

	test("prompt has production-ready length with embedded skills", () => {
		expect(typeof coderAgent.prompt).toBe("string");
		expect(coderAgent.prompt?.length).toBeGreaterThanOrEqual(100);
	});

	test("prompt references RED, GREEN, REFACTOR phases", () => {
		const prompt = (coderAgent.prompt ?? "").toLowerCase();
		expect(prompt).toContain("red");
		expect(prompt).toContain("green");
		expect(prompt).toContain("refactor");
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
