import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAllSkills, parseSkillFrontmatter } from "../../src/skills/loader";

describe("parseSkillFrontmatter", () => {
	test("parses valid frontmatter with all fields", () => {
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
		expect(result?.mcp).toBeNull();
	});

	test("returns null for content without frontmatter", () => {
		const result = parseSkillFrontmatter("no frontmatter here");
		expect(result).toBeNull();
	});

	test("defaults missing fields to empty strings and arrays", () => {
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
		expect(result?.mcp).toBeNull();
	});

	test("filters non-string values from stacks array", () => {
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

	test("returns null for malformed YAML", () => {
		const content = `---
: : : invalid yaml
---`;

		const result = parseSkillFrontmatter(content);
		expect(result).toBeNull();
	});

	test("parses valid mcp frontmatter section", () => {
		const content = `---
name: docs
description: A docs skill
mcp:
  serverName: docs-server
  transport: http
  url: https://example.com/mcp
  scope:
    - read
    - execute
---
# Content`;

		const result = parseSkillFrontmatter(content);
		expect(result?.mcp).not.toBeNull();
		expect(result?.mcp?.serverName).toBe("docs-server");
		expect(result?.mcp?.transport).toBe("http");
		expect(result?.mcp?.scope).toEqual(["read", "execute"]);
	});

	test("drops invalid mcp section gracefully", () => {
		const content = `---
name: docs
mcp:
  serverName: docs-server
  transport: http
  url: not-a-url
---
# Content`;

		const result = parseSkillFrontmatter(content);
		expect(result).not.toBeNull();
		expect(result?.mcp).toBeNull();
	});

	test("ignores non-object mcp frontmatter", () => {
		const content = `---
name: docs
mcp: true
---
# Content`;

		const result = parseSkillFrontmatter(content);
		expect(result).not.toBeNull();
		expect(result?.mcp).toBeNull();
	});
});

describe("loadAllSkills", () => {
	test("loads skills from directory with valid SKILL.md files", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "skills-test-"));
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

	test("returns empty map for non-existent directory", async () => {
		const skills = await loadAllSkills("/tmp/nonexistent-skills-dir-xyz");
		expect(skills.size).toBe(0);
	});

	test("skips directories without valid SKILL.md", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "skills-test-"));
		const emptyDir = join(tempDir, "broken-skill");
		await mkdir(emptyDir, { recursive: true });
		await writeFile(join(emptyDir, "SKILL.md"), "no frontmatter");

		const skills = await loadAllSkills(tempDir);
		expect(skills.size).toBe(0);

		await rm(tempDir, { recursive: true, force: true });
	});

	test("loads valid skill with mcp frontmatter", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "skills-test-"));
		const skillDir = join(tempDir, "docs");
		await mkdir(skillDir, { recursive: true });
		await writeFile(
			join(skillDir, "SKILL.md"),
			`---
name: docs
description: Docs skill
stacks: []
requires: []
mcp:
  serverName: docs-server
  command: npx
---
# Docs`,
		);

		const skills = await loadAllSkills(tempDir);
		expect(skills.get("docs")?.frontmatter.mcp?.serverName).toBe("docs-server");

		await rm(tempDir, { recursive: true, force: true });
	});

	test("sorts loaded skills alphabetically", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "skills-test-"));
		for (const name of ["zeta", "alpha"]) {
			const skillDir = join(tempDir, name);
			await mkdir(skillDir, { recursive: true });
			await writeFile(
				join(skillDir, "SKILL.md"),
				`---
name: ${name}
stacks: []
requires: []
---
# ${name}`,
			);
		}

		const skills = await loadAllSkills(tempDir);
		expect([...skills.keys()]).toEqual(["alpha", "zeta"]);

		await rm(tempDir, { recursive: true, force: true });
	});
});
