import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildMultiSkillContext,
	detectProjectStackTags,
	filterSkillsByStack,
} from "../../src/skills/adaptive-injector";
import type { LoadedSkill } from "../../src/skills/loader";

function makeSkill(name: string, stacks: string[], requires: string[] = []): LoadedSkill {
	return {
		frontmatter: { name, description: "", stacks, requires },
		content: `---\nname: ${name}\n---\n# ${name} content`,
		path: `/fake/${name}/SKILL.md`,
	};
}

describe("detectProjectStackTags", () => {
	let tempDir: string;

	it("detects javascript and typescript from package.json and tsconfig.json", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "stack-test-"));
		await writeFile(join(tempDir, "package.json"), "{}");
		await writeFile(join(tempDir, "tsconfig.json"), "{}");

		const tags = await detectProjectStackTags(tempDir);
		expect(tags).toContain("javascript");
		expect(tags).toContain("typescript");

		await rm(tempDir, { recursive: true, force: true });
	});

	it("returns empty array for directory with no manifest files", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "stack-test-"));
		const tags = await detectProjectStackTags(tempDir);
		expect(tags).toEqual([]);
		await rm(tempDir, { recursive: true, force: true });
	});

	it("detects go from go.mod", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "stack-test-"));
		await writeFile(join(tempDir, "go.mod"), "module test");

		const tags = await detectProjectStackTags(tempDir);
		expect(tags).toContain("go");

		await rm(tempDir, { recursive: true, force: true });
	});

	it("detects csharp from .csproj file via extension matching", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "stack-test-"));
		await writeFile(join(tempDir, "MyProject.csproj"), "<Project />");

		const tags = await detectProjectStackTags(tempDir);
		expect(tags).toContain("csharp");

		await rm(tempDir, { recursive: true, force: true });
	});

	it("detects csharp from .sln file via extension matching", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "stack-test-"));
		await writeFile(join(tempDir, "MySolution.sln"), "");

		const tags = await detectProjectStackTags(tempDir);
		expect(tags).toContain("csharp");

		await rm(tempDir, { recursive: true, force: true });
	});

	it("detects java from pom.xml", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "stack-test-"));
		await writeFile(join(tempDir, "pom.xml"), "<project />");

		const tags = await detectProjectStackTags(tempDir);
		expect(tags).toContain("java");

		await rm(tempDir, { recursive: true, force: true });
	});

	it("deduplicates tags when both .csproj and .sln are present", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "stack-test-"));
		await writeFile(join(tempDir, "MyProject.csproj"), "<Project />");
		await writeFile(join(tempDir, "MySolution.sln"), "");

		const tags = await detectProjectStackTags(tempDir);
		const csharpCount = tags.filter((t) => t === "csharp").length;
		expect(csharpCount).toBe(1);

		await rm(tempDir, { recursive: true, force: true });
	});

	it("handles mixed project with both package.json and .csproj", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "stack-test-"));
		await writeFile(join(tempDir, "package.json"), "{}");
		await writeFile(join(tempDir, "MyProject.csproj"), "<Project />");

		const tags = await detectProjectStackTags(tempDir);
		expect(tags).toContain("javascript");
		expect(tags).toContain("csharp");

		await rm(tempDir, { recursive: true, force: true });
	});
});

describe("filterSkillsByStack", () => {
	it("always includes skills with empty stacks (methodology skills)", () => {
		const skills = new Map<string, LoadedSkill>([
			["methodology", makeSkill("methodology", [])],
			["go-patterns", makeSkill("go-patterns", ["go"])],
		]);

		const filtered = filterSkillsByStack(skills, ["typescript"]);
		expect(filtered.has("methodology")).toBe(true);
		expect(filtered.has("go-patterns")).toBe(false);
	});

	it("includes skills matching detected stack tags", () => {
		const skills = new Map<string, LoadedSkill>([
			["ts-patterns", makeSkill("ts-patterns", ["typescript"])],
			["go-patterns", makeSkill("go-patterns", ["go"])],
		]);

		const filtered = filterSkillsByStack(skills, ["typescript"]);
		expect(filtered.has("ts-patterns")).toBe(true);
		expect(filtered.has("go-patterns")).toBe(false);
	});

	it("includes skill if any of its stacks match any tag", () => {
		const skills = new Map<string, LoadedSkill>([
			["web", makeSkill("web", ["typescript", "react"])],
		]);

		const filtered = filterSkillsByStack(skills, ["typescript"]);
		expect(filtered.has("web")).toBe(true);
	});
});

describe("buildMultiSkillContext", () => {
	it("returns empty string for empty skills map", () => {
		const result = buildMultiSkillContext(new Map());
		expect(result).toBe("");
	});

	it("builds context with skill sections", () => {
		const skills = new Map<string, LoadedSkill>([
			["coding-standards", makeSkill("coding-standards", [])],
		]);

		const result = buildMultiSkillContext(skills);
		expect(result).toContain("Skills context");
		expect(result).toContain("[Skill: coding-standards]");
	});

	it("respects token budget", () => {
		// Create a skill with very large content
		const bigContent = "x".repeat(50000);
		const bigSkill: LoadedSkill = {
			frontmatter: { name: "big", description: "", stacks: [], requires: [] },
			content: bigContent,
			path: "/fake/big/SKILL.md",
		};

		const skills = new Map<string, LoadedSkill>([["big", bigSkill]]);

		// With very small token budget (100 tokens = 400 chars), skill should be excluded
		const result = buildMultiSkillContext(skills, 100);
		expect(result).toBe("");
	});

	it("orders skills by dependency", () => {
		const skills = new Map<string, LoadedSkill>([
			["advanced", makeSkill("advanced", [], ["basics"])],
			["basics", makeSkill("basics", [])],
		]);

		const result = buildMultiSkillContext(skills);
		const basicsIdx = result.indexOf("[Skill: basics]");
		const advancedIdx = result.indexOf("[Skill: advanced]");
		expect(basicsIdx).toBeLessThan(advancedIdx);
	});
});
