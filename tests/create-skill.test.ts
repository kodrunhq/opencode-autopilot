import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSkillCore } from "../src/tools/create-skill";

describe("createSkillCore", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "oc-test-skill-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("writes SKILL.md to skill directory", async () => {
		const result = await createSkillCore(
			{
				name: "typescript-patterns",
				description: "TypeScript best practices and patterns",
			},
			tempDir,
		);

		expect(result).toContain("typescript-patterns");
		expect(result).toContain("Restart OpenCode");

		const filePath = join(tempDir, "skills", "typescript-patterns", "SKILL.md");
		const content = await readFile(filePath, "utf-8");
		expect(content).toContain("name: typescript-patterns");
		expect(content).toContain("description: TypeScript best practices and patterns");
	});

	it("includes optional fields when provided", async () => {
		const result = await createSkillCore(
			{
				name: "api-design",
				description: "API design patterns",
				license: "MIT",
				compatibility: "opencode",
			},
			tempDir,
		);

		expect(result).toContain("api-design");
		const filePath = join(tempDir, "skills", "api-design", "SKILL.md");
		const content = await readFile(filePath, "utf-8");
		expect(content).toContain("license: MIT");
		expect(content).toContain("compatibility: opencode");
	});

	it("returns validation error for invalid name", async () => {
		const result = await createSkillCore(
			{
				name: "Bad_Skill",
				description: "Invalid",
			},
			tempDir,
		);

		expect(result).toContain("invalid");
	});

	it("returns error when skill already exists", async () => {
		await createSkillCore(
			{
				name: "my-skill",
				description: "First version",
			},
			tempDir,
		);

		const result = await createSkillCore(
			{
				name: "my-skill",
				description: "Second version",
			},
			tempDir,
		);

		expect(result).toContain("already exists");
	});
});
