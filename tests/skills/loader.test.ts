import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAllSkills, parseSkillFrontmatter } from "../../src/skills/loader";

describe("parseSkillFrontmatter", () => {
	it("parses valid frontmatter with all fields", () => {
		const content = `---
name: test-skill
description: A test skill
stacks:
  - typescript
  - javascript
requires:
  - coding-standards
---
# Content here`;

		const result = parseSkillFrontmatter(content);
		expect(result).not.toBeNull();
		expect(result?.name).toBe("test-skill");
		expect(result?.description).toBe("A test skill");
		expect(result?.stacks).toEqual(["typescript", "javascript"]);
		expect(result?.requires).toEqual(["coding-standards"]);
	});

	it("returns null for content without frontmatter", () => {
		const result = parseSkillFrontmatter("no frontmatter here");
		expect(result).toBeNull();
	});

	it("defaults missing fields to empty strings/arrays", () => {
		const content = `---
name: minimal
---
# Just a name`;

		const result = parseSkillFrontmatter(content);
		expect(result).not.toBeNull();
		expect(result?.name).toBe("minimal");
		expect(result?.description).toBe("");
		expect(result?.stacks).toEqual([]);
		expect(result?.requires).toEqual([]);
	});

	it("filters non-string values from stacks array", () => {
		const content = `---
name: mixed
stacks:
  - typescript
  - 123
  - true
---
# Content`;

		const result = parseSkillFrontmatter(content);
		expect(result).not.toBeNull();
		expect(result?.stacks).toEqual(["typescript"]);
	});

	it("returns null for malformed YAML", () => {
		const content = `---
: : : invalid yaml
---`;

		const result = parseSkillFrontmatter(content);
		expect(result).toBeNull();
	});
});

describe("loadAllSkills", () => {
	let tempDir: string;

	it("loads skills from directory with valid SKILL.md files", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "skills-test-"));
		const skillDir = join(tempDir, "coding-standards");
		await mkdir(skillDir, { recursive: true });
		await writeFile(
			join(skillDir, "SKILL.md"),
			`---
name: coding-standards
stacks: []
requires: []
---
# Coding Standards`,
		);

		const skills = await loadAllSkills(tempDir);
		expect(skills.size).toBe(1);
		expect(skills.has("coding-standards")).toBe(true);
		expect(skills.get("coding-standards")?.frontmatter.name).toBe("coding-standards");

		await rm(tempDir, { recursive: true, force: true });
	});

	it("returns empty map for non-existent directory", async () => {
		const skills = await loadAllSkills("/tmp/nonexistent-skills-dir-xyz");
		expect(skills.size).toBe(0);
	});

	it("skips directories without valid SKILL.md", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "skills-test-"));
		const emptyDir = join(tempDir, "broken-skill");
		await mkdir(emptyDir, { recursive: true });
		await writeFile(join(emptyDir, "SKILL.md"), "no frontmatter");

		const skills = await loadAllSkills(tempDir);
		expect(skills.size).toBe(0);

		await rm(tempDir, { recursive: true, force: true });
	});
});
