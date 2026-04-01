// tests/registry/diversity.test.ts
import { describe, expect, test } from "bun:test";
import { checkDiversity } from "../../src/registry/diversity";
import type { GroupModelAssignment } from "../../src/registry/types";

describe("checkDiversity", () => {
	test("returns empty when all adversarial pairs use different families", () => {
		const groups: Record<string, GroupModelAssignment> = {
			architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
			challengers: { primary: "openai/gpt-5.4", fallbacks: [] },
			builders: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
			reviewers: { primary: "openai/gpt-5.4", fallbacks: [] },
			"red-team": { primary: "google/gemini-3.1-pro", fallbacks: [] },
		};
		const warnings = checkDiversity(groups);
		expect(warnings).toHaveLength(0);
	});

	test("warns when architects and challengers share a family (strong)", () => {
		const groups: Record<string, GroupModelAssignment> = {
			architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
			challengers: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
		};
		const warnings = checkDiversity(groups);
		expect(warnings).toHaveLength(1);
		expect(warnings[0].sharedFamily).toBe("anthropic");
		expect(warnings[0].rule.severity).toBe("strong");
		expect(warnings[0].groups).toContain("architects");
		expect(warnings[0].groups).toContain("challengers");
	});

	test("warns when builders and reviewers share a family (strong)", () => {
		const groups: Record<string, GroupModelAssignment> = {
			builders: { primary: "openai/gpt-5.4", fallbacks: [] },
			reviewers: { primary: "openai/gpt-5.4-mini", fallbacks: [] },
		};
		const warnings = checkDiversity(groups);
		expect(warnings).toHaveLength(1);
		expect(warnings[0].rule.severity).toBe("strong");
	});

	test("warns when red-team shares family with builders (soft)", () => {
		const groups: Record<string, GroupModelAssignment> = {
			builders: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
			reviewers: { primary: "openai/gpt-5.4", fallbacks: [] },
			"red-team": { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
		};
		const warnings = checkDiversity(groups);
		expect(warnings).toHaveLength(1);
		expect(warnings[0].rule.severity).toBe("soft");
	});

	test("skips rules when groups are not assigned", () => {
		const groups: Record<string, GroupModelAssignment> = {
			architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
			// challengers not assigned — rule skipped
		};
		const warnings = checkDiversity(groups);
		expect(warnings).toHaveLength(0);
	});

	test("3-group rule: all different families = no warning", () => {
		const groups: Record<string, GroupModelAssignment> = {
			builders: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
			reviewers: { primary: "openai/gpt-5.4", fallbacks: [] },
			"red-team": { primary: "google/gemini-3.1-pro", fallbacks: [] },
		};
		const warnings = checkDiversity(groups);
		const redTeamWarning = warnings.find((w) =>
			w.rule.groups.includes("red-team"),
		);
		expect(redTeamWarning).toBeUndefined();
	});

	test("returns frozen array", () => {
		const warnings = checkDiversity({});
		expect(Object.isFrozen(warnings)).toBe(true);
	});
});
