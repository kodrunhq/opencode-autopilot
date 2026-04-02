import { describe, expect, it } from "bun:test";
import { lintAgent, lintCommand, lintSkill } from "../../src/skills/linter";

describe("lintSkill", () => {
	it("returns valid for correct skill frontmatter", () => {
		const result = lintSkill(
			"---\nname: test\ndescription: desc\nstacks: []\nrequires: []\n---\n# Content",
		);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("returns invalid for missing frontmatter", () => {
		const result = lintSkill("no frontmatter");
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Missing YAML frontmatter");
	});

	it("returns invalid for missing name field", () => {
		const result = lintSkill("---\ndescription: desc\n---\n# Content");
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(expect.arrayContaining(["Missing required field: name"]));
	});

	it("returns invalid for missing description field", () => {
		const result = lintSkill("---\nname: test\n---\n# Content");
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining(["Missing required field: description"]),
		);
	});

	it("warns about missing stacks field", () => {
		const result = lintSkill("---\nname: test\ndescription: desc\n---\n# Content");
		expect(result.valid).toBe(true);
		expect(result.warnings.length).toBeGreaterThan(0);
		expect(result.warnings.some((w) => w.includes("stacks"))).toBe(true);
	});

	it("warns about missing requires field", () => {
		const result = lintSkill("---\nname: test\ndescription: desc\n---\n# Content");
		expect(result.warnings.some((w) => w.includes("requires"))).toBe(true);
	});

	it("returns error when stacks contains non-strings", () => {
		const result = lintSkill(
			"---\nname: test\ndescription: desc\nstacks: [1, 2]\nrequires: []\n---\n# Content",
		);
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining(["stacks must contain only strings"]),
		);
	});

	it("warns about empty body", () => {
		const result = lintSkill("---\nname: test\ndescription: desc\nstacks: []\nrequires: []\n---");
		expect(result.warnings.some((w) => w.includes("no content"))).toBe(true);
	});
});

describe("lintCommand", () => {
	it("returns valid for correct command frontmatter", () => {
		const result = lintCommand("---\ndescription: desc\n---\nContent");
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("returns invalid for missing frontmatter", () => {
		const result = lintCommand("no frontmatter");
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Missing YAML frontmatter");
	});

	it("returns invalid for missing description", () => {
		const result = lintCommand("---\n---\nContent");
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining(["Missing required field: description"]),
		);
	});

	it("warns about empty body", () => {
		const result = lintCommand("---\ndescription: desc\n---");
		expect(result.warnings.some((w) => w.includes("no content"))).toBe(true);
	});
});

describe("lintAgent", () => {
	it("returns valid for correct agent frontmatter", () => {
		const result = lintAgent("---\nname: test-agent\n---\nContent");
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("returns invalid for missing frontmatter", () => {
		const result = lintAgent("no frontmatter");
		expect(result.valid).toBe(false);
	});

	it("returns invalid for missing name", () => {
		const result = lintAgent("---\ndescription: something\n---\nContent");
		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(expect.arrayContaining(["Missing required field: name"]));
	});
});
