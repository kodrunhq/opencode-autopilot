import { describe, expect, test } from "bun:test";
import {
	ALL_REVIEW_AGENTS,
	REVIEW_AGENTS,
	SPECIALIZED_AGENTS,
	STAGE3_AGENTS,
} from "../../src/review/agents/index";

describe("review agent registry", () => {
	test("REVIEW_AGENTS has exactly 6 entries", () => {
		expect(REVIEW_AGENTS).toHaveLength(6);
	});

	test("STAGE3_AGENTS has exactly 2 entries", () => {
		expect(STAGE3_AGENTS).toHaveLength(2);
	});

	test("SPECIALIZED_AGENTS has exactly 13 entries", () => {
		expect(SPECIALIZED_AGENTS).toHaveLength(13);
	});

	test("ALL_REVIEW_AGENTS has exactly 21 entries", () => {
		expect(ALL_REVIEW_AGENTS).toHaveLength(21);
	});

	test("ALL_REVIEW_AGENTS is the union of REVIEW_AGENTS, SPECIALIZED_AGENTS, and STAGE3_AGENTS", () => {
		const combined = [...REVIEW_AGENTS, ...SPECIALIZED_AGENTS, ...STAGE3_AGENTS];
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
		expect(Object.isFrozen(SPECIALIZED_AGENTS)).toBe(true);
		expect(Object.isFrozen(ALL_REVIEW_AGENTS)).toBe(true);
	});

	test("no agent references configHook or AgentConfig (D-01 compliance)", () => {
		for (const agent of ALL_REVIEW_AGENTS) {
			const serialized = JSON.stringify(agent);
			expect(serialized).not.toContain("configHook");
			expect(serialized).not.toContain("AgentConfig");
		}
	});

	test("every agent has a valid severityFocus array (CRITICAL/HIGH/MEDIUM/LOW only)", () => {
		const validSeverities = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
		for (const agent of ALL_REVIEW_AGENTS) {
			expect(agent.severityFocus.length).toBeGreaterThan(0);
			for (const severity of agent.severityFocus) {
				expect(validSeverities.has(severity)).toBe(true);
			}
		}
	});

	test("every agent prompt contains severity values (not WARNING/NITPICK)", () => {
		for (const agent of ALL_REVIEW_AGENTS) {
			expect(agent.prompt).toContain("CRITICAL");
			expect(agent.prompt).not.toContain("WARNING");
			expect(agent.prompt).not.toContain("NITPICK");
		}
	});

	test("stack-gated agents have non-empty relevantStacks", () => {
		const stackGated = [
			"type-soundness",
			"state-mgmt-auditor",
			"react-patterns-auditor",
			"go-idioms-auditor",
			"python-django-auditor",
			"rust-safety-auditor",
		];
		for (const name of stackGated) {
			const agent = ALL_REVIEW_AGENTS.find((a) => a.name === name);
			expect(agent).toBeDefined();
			expect(agent?.relevantStacks.length).toBeGreaterThan(0);
		}
	});

	test("universal specialized agents have empty relevantStacks", () => {
		const universalSpecialists = [
			"wiring-inspector",
			"dead-code-scanner",
			"spec-checker",
			"database-auditor",
			"auth-flow-verifier",
			"concurrency-checker",
			"scope-intent-verifier",
		];
		for (const name of universalSpecialists) {
			const agent = ALL_REVIEW_AGENTS.find((a) => a.name === name);
			expect(agent).toBeDefined();
			expect(agent?.relevantStacks).toHaveLength(0);
		}
	});
});
