// tests/registry/doctor.test.ts
import { describe, expect, test } from "bun:test";
import type { DiagnosableConfig } from "../../src/registry/doctor";
import { diagnose } from "../../src/registry/doctor";
import type { GroupModelAssignment } from "../../src/registry/types";

/** Helper: build a full groups record with all 8 groups assigned to diverse families. */
function makeFullGroups(): Record<string, GroupModelAssignment> {
	return {
		architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
		challengers: { primary: "openai/gpt-5.4", fallbacks: [] },
		builders: { primary: "google/gemini-3.1-pro", fallbacks: [] },
		reviewers: { primary: "mistral/mistral-large", fallbacks: [] },
		"red-team": { primary: "deepseek/deepseek-r1", fallbacks: [] },
		researchers: { primary: "meta/llama-4-maverick", fallbacks: [] },
		communicators: { primary: "cohere/command-r-plus", fallbacks: [] },
		utilities: { primary: "anthropic/claude-haiku-4-5", fallbacks: ["openai/gpt-4.1-mini"] },
	};
}

describe("diagnose", () => {
	test("null config returns configExists: false and allPassed: false", () => {
		const result = diagnose(null);

		expect(result.configExists).toBe(false);
		expect(result.schemaValid).toBe(false);
		expect(result.configured).toBe(false);
		expect(result.allPassed).toBe(false);
		// All groups should show as unassigned
		for (const [, group] of Object.entries(result.groupsAssigned)) {
			expect(group.assigned).toBe(false);
			expect(group.primary).toBeNull();
			expect(group.fallbacks).toHaveLength(0);
		}
	});

	test("config with configured: false — configured check fails", () => {
		const config: DiagnosableConfig = {
			configured: false,
			version: 1,
			groups: makeFullGroups(),
		};
		const result = diagnose(config);

		expect(result.configExists).toBe(true);
		expect(result.schemaValid).toBe(true);
		expect(result.configured).toBe(false);
		expect(result.allPassed).toBe(false);
	});

	test("config with configured: true and all 8 groups assigned with diverse models — all pass", () => {
		const config: DiagnosableConfig = {
			configured: true,
			version: 1,
			groups: makeFullGroups(),
		};
		const result = diagnose(config);

		expect(result.configExists).toBe(true);
		expect(result.schemaValid).toBe(true);
		expect(result.configured).toBe(true);
		expect(result.diversityWarnings).toHaveLength(0);
		expect(result.allPassed).toBe(true);

		// Every group should be assigned
		for (const [, group] of Object.entries(result.groupsAssigned)) {
			expect(group.assigned).toBe(true);
			expect(group.primary).not.toBeNull();
		}
	});

	test("partially assigned groups (3 of 8) — unassigned groups show assigned: false", () => {
		const config: DiagnosableConfig = {
			configured: true,
			version: 1,
			groups: {
				architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
				builders: { primary: "google/gemini-3.1-pro", fallbacks: [] },
				reviewers: { primary: "openai/gpt-5.4", fallbacks: [] },
			},
		};
		const result = diagnose(config);

		// Assigned groups
		expect(result.groupsAssigned.architects.assigned).toBe(true);
		expect(result.groupsAssigned.builders.assigned).toBe(true);
		expect(result.groupsAssigned.reviewers.assigned).toBe(true);

		// Unassigned groups
		expect(result.groupsAssigned.challengers.assigned).toBe(false);
		expect(result.groupsAssigned.challengers.primary).toBeNull();
		expect(result.groupsAssigned["red-team"].assigned).toBe(false);
		expect(result.groupsAssigned.researchers.assigned).toBe(false);
		expect(result.groupsAssigned.communicators.assigned).toBe(false);
		expect(result.groupsAssigned.utilities.assigned).toBe(false);
	});

	test("diversity violations (architects + challengers same family) — warning appears", () => {
		const config: DiagnosableConfig = {
			configured: true,
			version: 1,
			groups: {
				...makeFullGroups(),
				// Override challengers to same family as architects
				architects: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
				challengers: { primary: "anthropic/claude-sonnet-4-6", fallbacks: [] },
			},
		};
		const result = diagnose(config);

		expect(result.diversityWarnings.length).toBeGreaterThan(0);
		// diversityWarnings are advisory — they don't affect allPassed
		expect(result.allPassed).toBe(true);

		const architectsChallengersWarning = result.diversityWarnings.find(
			(w) => w.groups.includes("architects") && w.groups.includes("challengers"),
		);
		expect(architectsChallengersWarning).toBeDefined();
		expect(architectsChallengersWarning?.sharedFamily).toBe("anthropic");
	});

	test("return value is frozen", () => {
		const result = diagnose(null);
		expect(Object.isFrozen(result)).toBe(true);

		const fullResult = diagnose({
			configured: true,
			version: 1,
			groups: makeFullGroups(),
		});
		expect(Object.isFrozen(fullResult)).toBe(true);
		expect(Object.isFrozen(fullResult.groupsAssigned)).toBe(true);
	});
});
