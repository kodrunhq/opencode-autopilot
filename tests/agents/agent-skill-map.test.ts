import { describe, expect, test } from "bun:test";
import {
	AGENT_PROMPT_PREFIXES,
	AGENT_SKILL_MAP,
	detectAgentFromPrompt,
} from "../../src/agents/agent-skill-map";

describe("AGENT_SKILL_MAP", () => {
	test("maps coder to tdd-workflow and coding-standards", () => {
		expect(AGENT_SKILL_MAP.coder).toEqual(["tdd-workflow", "coding-standards"]);
	});

	test("maps planner to plan-writing and plan-executing", () => {
		expect(AGENT_SKILL_MAP.planner).toEqual(["plan-writing", "plan-executing"]);
	});

	test("maps reviewer to code-review", () => {
		expect(AGENT_SKILL_MAP.reviewer).toEqual(["code-review"]);
	});

	test("maps debugger to systematic-debugging", () => {
		expect(AGENT_SKILL_MAP.debugger).toEqual(["systematic-debugging"]);
	});

	test("maps security-auditor to security-patterns", () => {
		expect(AGENT_SKILL_MAP["security-auditor"]).toEqual(["security-patterns"]);
	});

	test("has exactly 5 mapped agents", () => {
		expect(Object.keys(AGENT_SKILL_MAP)).toHaveLength(5);
	});

	test("all skill arrays are frozen (immutable)", () => {
		for (const skills of Object.values(AGENT_SKILL_MAP)) {
			expect(Object.isFrozen(skills)).toBe(true);
		}
	});

	test("map itself is frozen (immutable)", () => {
		expect(Object.isFrozen(AGENT_SKILL_MAP)).toBe(true);
	});
});

describe("AGENT_PROMPT_PREFIXES", () => {
	test("has a prefix for every agent in AGENT_SKILL_MAP", () => {
		for (const agentName of Object.keys(AGENT_SKILL_MAP)) {
			expect(AGENT_PROMPT_PREFIXES[agentName]).toBeDefined();
		}
	});

	test("prefixes are non-empty strings", () => {
		for (const prefix of Object.values(AGENT_PROMPT_PREFIXES)) {
			expect(typeof prefix).toBe("string");
			expect(prefix.length).toBeGreaterThan(0);
		}
	});

	test("is frozen (immutable)", () => {
		expect(Object.isFrozen(AGENT_PROMPT_PREFIXES)).toBe(true);
	});

	test("each prefix is unique", () => {
		const prefixes = Object.values(AGENT_PROMPT_PREFIXES);
		const unique = new Set(prefixes);
		expect(unique.size).toBe(prefixes.length);
	});
});

describe("detectAgentFromPrompt", () => {
	test("detects coder agent from prompt starting with its prefix", () => {
		const prompt = "You are the coder agent. Write production code.";
		expect(detectAgentFromPrompt(prompt)).toBe("coder");
	});

	test("detects planner agent from prompt starting with its prefix", () => {
		const prompt = "You are the planner agent. Decompose work into tasks.";
		expect(detectAgentFromPrompt(prompt)).toBe("planner");
	});

	test("detects reviewer agent from prompt starting with its prefix", () => {
		const prompt = "You are the code reviewer agent. Review changes.";
		expect(detectAgentFromPrompt(prompt)).toBe("reviewer");
	});

	test("detects debugger agent from prompt starting with its prefix", () => {
		const prompt = "You are the debugger agent. Find root causes.";
		expect(detectAgentFromPrompt(prompt)).toBe("debugger");
	});

	test("detects security-auditor agent from prompt starting with its prefix", () => {
		const prompt = "You are a security auditor. Identify vulnerabilities.";
		expect(detectAgentFromPrompt(prompt)).toBe("security-auditor");
	});

	test("returns undefined for unknown prompt prefix", () => {
		expect(detectAgentFromPrompt("You are the autopilot agent.")).toBeUndefined();
	});

	test("returns undefined for empty string", () => {
		expect(detectAgentFromPrompt("")).toBeUndefined();
	});

	test("returns undefined when prefix appears mid-string", () => {
		const prompt = "Note: You are the coder agent.";
		expect(detectAgentFromPrompt(prompt)).toBeUndefined();
	});

	test("detects agent from full multi-line prompt", () => {
		const fullPrompt = `You are the coder agent.

## Steps
1. Write tests first (RED).
2. Make them pass (GREEN).
3. Refactor (REFACTOR).`;
		expect(detectAgentFromPrompt(fullPrompt)).toBe("coder");
	});
});
