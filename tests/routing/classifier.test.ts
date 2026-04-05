import { describe, expect, test } from "bun:test";
import { classifyTask } from "../../src/routing";

describe("classifyTask", () => {
	test("classifies typo fixes as quick with high confidence", () => {
		const result = classifyTask("fix typo in README");
		expect(result.category).toBe("quick");
		expect(result.confidence).toBeGreaterThanOrEqual(0.7);
	});

	test("classifies auth implementation work as unspecified-high", () => {
		const result = classifyTask("implement JWT authentication with refresh tokens");
		expect(result.category).toBe("unspecified-high");
		expect(result.confidence).toBeGreaterThan(0.5);
	});

	test("classifies dark mode work as visual-engineering", () => {
		const result = classifyTask("add dark mode toggle to settings page");
		expect(result.category).toBe("visual-engineering");
	});

	test("classifies performance optimization as ultrabrain", () => {
		const result = classifyTask("optimize database query performance");
		expect(result.category).toBe("ultrabrain");
	});

	test("classifies documentation writing as writing", () => {
		const result = classifyTask("write API documentation");
		expect(result.category).toBe("writing");
	});

	test("prioritizes file pattern matches before keywords", () => {
		const result = classifyTask("simple cleanup", ["src/components/Button.tsx"]);
		expect(result.category).toBe("visual-engineering");
	});
});
