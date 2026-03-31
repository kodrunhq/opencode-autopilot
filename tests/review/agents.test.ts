import { describe, expect, test } from "bun:test";
import { ALL_REVIEW_AGENTS, REVIEW_AGENTS, STAGE3_AGENTS } from "../../src/review/agents/index";

describe("review agent registry", () => {
	test("REVIEW_AGENTS has exactly 6 entries", () => {
		expect(REVIEW_AGENTS).toHaveLength(6);
	});

	test("STAGE3_AGENTS has exactly 2 entries", () => {
		expect(STAGE3_AGENTS).toHaveLength(2);
	});

	test("ALL_REVIEW_AGENTS has exactly 8 entries", () => {
		expect(ALL_REVIEW_AGENTS).toHaveLength(8);
	});

	test("ALL_REVIEW_AGENTS is the union of REVIEW_AGENTS and STAGE3_AGENTS", () => {
		const combined = [...REVIEW_AGENTS, ...STAGE3_AGENTS];
		expect(ALL_REVIEW_AGENTS).toHaveLength(combined.length);
		for (const agent of combined) {
			expect(ALL_REVIEW_AGENTS).toContain(agent);
		}
	});

	test("every agent has non-empty name, description, and prompt", () => {
		for (const agent of ALL_REVIEW_AGENTS) {
			expect(agent.name.length).toBeGreaterThan(0);
			expect(agent.description.length).toBeGreaterThan(0);
			expect(agent.prompt.length).toBeGreaterThan(0);
		}
	});

	test("every agent name is unique", () => {
		const names = ALL_REVIEW_AGENTS.map((a) => a.name);
		expect(new Set(names).size).toBe(names.length);
	});

	test("every agent prompt contains {{DIFF}} placeholder", () => {
		for (const agent of ALL_REVIEW_AGENTS) {
			expect(agent.prompt).toContain("{{DIFF}}");
		}
	});

	test("every agent prompt contains {{PRIOR_FINDINGS}} placeholder", () => {
		for (const agent of ALL_REVIEW_AGENTS) {
			expect(agent.prompt).toContain("{{PRIOR_FINDINGS}}");
		}
	});

	test("every agent prompt contains {{MEMORY}} placeholder", () => {
		for (const agent of ALL_REVIEW_AGENTS) {
			expect(agent.prompt).toContain("{{MEMORY}}");
		}
	});

	test("every universal agent has empty relevantStacks array", () => {
		for (const agent of REVIEW_AGENTS) {
			expect(agent.relevantStacks).toHaveLength(0);
		}
	});

	test("every agent object is frozen", () => {
		for (const agent of ALL_REVIEW_AGENTS) {
			expect(Object.isFrozen(agent)).toBe(true);
		}
	});

	test("registry arrays are frozen", () => {
		expect(Object.isFrozen(REVIEW_AGENTS)).toBe(true);
		expect(Object.isFrozen(STAGE3_AGENTS)).toBe(true);
		expect(Object.isFrozen(ALL_REVIEW_AGENTS)).toBe(true);
	});

	test("no agent references configHook or AgentConfig (D-01 compliance)", () => {
		for (const agent of ALL_REVIEW_AGENTS) {
			const serialized = JSON.stringify(agent);
			expect(serialized).not.toContain("configHook");
			expect(serialized).not.toContain("AgentConfig");
		}
	});

	test("every agent has a valid severityFocus array (CRITICAL/WARNING/NITPICK only)", () => {
		const validSeverities = new Set(["CRITICAL", "WARNING", "NITPICK"]);
		for (const agent of ALL_REVIEW_AGENTS) {
			expect(agent.severityFocus.length).toBeGreaterThan(0);
			for (const severity of agent.severityFocus) {
				expect(validSeverities.has(severity)).toBe(true);
			}
		}
	});
});
