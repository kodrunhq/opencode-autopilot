// tests/registry/model-groups.test.ts
import { describe, expect, test } from "bun:test";
import {
	AGENT_REGISTRY,
	ALL_GROUP_IDS,
	DIVERSITY_RULES,
	GROUP_DEFINITIONS,
} from "../../src/registry/model-groups";
import type { GroupId } from "../../src/registry/types";

describe("ALL_GROUP_IDS", () => {
	test("has one entry per GROUP_DEFINITIONS key", () => {
		expect(ALL_GROUP_IDS).toHaveLength(Object.keys(GROUP_DEFINITIONS).length);
	});

	test("is frozen", () => {
		expect(Object.isFrozen(ALL_GROUP_IDS)).toBe(true);
	});
});

describe("AGENT_REGISTRY", () => {
	test("is frozen", () => {
		expect(Object.isFrozen(AGENT_REGISTRY)).toBe(true);
	});

	test("every agent maps to a valid GroupId", () => {
		for (const [_name, entry] of Object.entries(AGENT_REGISTRY)) {
			expect(ALL_GROUP_IDS).toContain(entry.group);
		}
	});

	test("every GroupId has at least one agent", () => {
		for (const groupId of ALL_GROUP_IDS) {
			const agents = Object.entries(AGENT_REGISTRY).filter(([, entry]) => entry.group === groupId);
			expect(agents.length).toBeGreaterThan(0);
		}
	});

	test("contains all expected pipeline agents", () => {
		const expected = [
			"oc-architect",
			"oc-planner",
			"autopilot",
			"planner",
			"oc-critic",
			"oc-challenger",
			"oc-implementer",
			"coder",
			"debugger",
			"oc-reviewer",
			"reviewer",
			"red-team",
			"product-thinker",
			"oc-researcher",
			"researcher",
			"oc-shipper",
			"metaprompter",
			"pr-reviewer",
			"security-auditor",
		];
		for (const name of expected) {
			expect(AGENT_REGISTRY).toHaveProperty(name);
		}
	});
});

describe("GROUP_DEFINITIONS", () => {
	test("has entries for all ALL_GROUP_IDS", () => {
		for (const groupId of ALL_GROUP_IDS) {
			expect(GROUP_DEFINITIONS).toHaveProperty(groupId);
		}
	});

	test("every definition has non-empty label, purpose, recommendation", () => {
		for (const def of Object.values(GROUP_DEFINITIONS)) {
			expect(def.label.length).toBeGreaterThan(0);
			expect(def.purpose.length).toBeGreaterThan(0);
			expect(def.recommendation.length).toBeGreaterThan(0);
		}
	});

	test("order values are sequential 1-8", () => {
		const orders = Object.values(GROUP_DEFINITIONS)
			.map((d) => d.order)
			.sort((a, b) => a - b);
		expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});

	test("id field matches the key", () => {
		for (const [key, def] of Object.entries(GROUP_DEFINITIONS)) {
			expect(def.id).toBe(key as GroupId);
		}
	});

	test("tier is one of heavy, medium, light", () => {
		for (const def of Object.values(GROUP_DEFINITIONS)) {
			expect(["heavy", "medium", "light"]).toContain(def.tier);
		}
	});

	test("GROUP_DEFINITIONS is frozen", () => {
		expect(Object.isFrozen(GROUP_DEFINITIONS)).toBe(true);
	});
});

describe("DIVERSITY_RULES", () => {
	test("is frozen", () => {
		expect(Object.isFrozen(DIVERSITY_RULES)).toBe(true);
	});

	test("all referenced groups are valid GroupIds", () => {
		for (const rule of DIVERSITY_RULES) {
			for (const groupId of rule.groups) {
				expect(ALL_GROUP_IDS).toContain(groupId);
			}
		}
	});

	test("has 3 rules", () => {
		expect(DIVERSITY_RULES).toHaveLength(3);
	});

	test("severity is strong or soft", () => {
		for (const rule of DIVERSITY_RULES) {
			expect(["strong", "soft"]).toContain(rule.severity);
		}
	});

	test("architects-challengers rule is strong", () => {
		const rule = DIVERSITY_RULES.find(
			(r) => r.groups.includes("architects") && r.groups.includes("challengers"),
		);
		expect(rule).toBeDefined();
		expect(rule?.severity).toBe("strong");
	});

	test("builders-reviewers rule is strong", () => {
		const rule = DIVERSITY_RULES.find(
			(r) => r.groups.includes("builders") && r.groups.includes("reviewers"),
		);
		expect(rule).toBeDefined();
		expect(rule?.severity).toBe("strong");
	});

	test("red-team multi-group rule is soft", () => {
		const rule = DIVERSITY_RULES.find((r) => r.groups.includes("red-team"));
		expect(rule).toBeDefined();
		expect(rule?.severity).toBe("soft");
		expect(rule?.groups).toHaveLength(3);
	});
});
