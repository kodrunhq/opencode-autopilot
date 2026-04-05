import { describe, expect, test } from "bun:test";
import { ALL_GROUP_IDS } from "../../src/registry/model-groups";
import { CATEGORY_DEFINITIONS, getAllCategories, getCategoryDefinition } from "../../src/routing";

describe("routing categories", () => {
	test("contains definitions for all supported categories", () => {
		expect(getAllCategories()).toHaveLength(7);
		expect(CATEGORY_DEFINITIONS.size).toBe(7);
	});

	test("every category has a valid model group and skills array", () => {
		for (const definition of getAllCategories()) {
			expect(ALL_GROUP_IDS).toContain(definition.modelGroup as (typeof ALL_GROUP_IDS)[number]);
			expect(Array.isArray(definition.skills)).toBe(true);
			expect(definition.description.length).toBeGreaterThan(0);
		}
	});

	test("getCategoryDefinition returns the requested category", () => {
		const definition = getCategoryDefinition("writing");
		expect(definition.category).toBe("writing");
		expect(definition.modelGroup).toBe("communicators");
	});
});
