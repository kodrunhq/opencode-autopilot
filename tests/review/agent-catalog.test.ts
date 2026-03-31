import { describe, expect, test } from "bun:test";
import {
	AGENT_CATALOG,
	CORE_SQUAD,
	getAgentsByCategory,
} from "../../src/review/agent-catalog";

describe("AGENT_CATALOG", () => {
	test("has 15+ entries", () => {
		expect(AGENT_CATALOG.length).toBeGreaterThanOrEqual(15);
	});

	test("is frozen (immutable)", () => {
		expect(Object.isFrozen(AGENT_CATALOG)).toBe(true);
	});

	test("each agent has required fields", () => {
		for (const agent of AGENT_CATALOG) {
			expect(typeof agent.name).toBe("string");
			expect(agent.name.length).toBeGreaterThan(0);
			expect(["core", "parallel", "sequenced"]).toContain(agent.category);
			expect(typeof agent.domain).toBe("string");
			expect(Array.isArray(agent.catches)).toBe(true);
			expect(Array.isArray(agent.stackAffinity)).toBe(true);
			expect(typeof agent.hardGatesSummary).toBe("string");
		}
	});

	test("agent names are unique", () => {
		const names = AGENT_CATALOG.map((a) => a.name);
		expect(new Set(names).size).toBe(names.length);
	});
});

describe("CORE_SQUAD", () => {
	test("contains logic-auditor", () => {
		expect(CORE_SQUAD.some((a) => a.name === "logic-auditor")).toBe(true);
	});

	test("contains test-interrogator", () => {
		expect(CORE_SQUAD.some((a) => a.name === "test-interrogator")).toBe(true);
	});

	test("contains contract-verifier", () => {
		expect(CORE_SQUAD.some((a) => a.name === "contract-verifier")).toBe(true);
	});

	test("has exactly 3 members", () => {
		expect(CORE_SQUAD).toHaveLength(3);
	});

	test("all have category core", () => {
		for (const agent of CORE_SQUAD) {
			expect(agent.category).toBe("core");
		}
	});
});

describe("getAgentsByCategory", () => {
	test("returns 10+ parallel agents", () => {
		const parallel = getAgentsByCategory("parallel");
		expect(parallel.length).toBeGreaterThanOrEqual(10);
		for (const agent of parallel) {
			expect(agent.category).toBe("parallel");
		}
	});

	test("returns product-thinker and red-team as sequenced", () => {
		const sequenced = getAgentsByCategory("sequenced");
		expect(sequenced.some((a) => a.name === "product-thinker")).toBe(true);
		expect(sequenced.some((a) => a.name === "red-team")).toBe(true);
	});

	test("returns exactly 3 core agents", () => {
		const core = getAgentsByCategory("core");
		expect(core).toHaveLength(3);
	});
});
