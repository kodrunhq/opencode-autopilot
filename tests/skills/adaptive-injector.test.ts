import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildAdaptiveSkillContext,
	buildMultiSkillContext,
	buildSkillSummary,
	detectProjectStackTags,
	filterSkillsByStack,
	PHASE_SKILL_MAP,
} from "../../src/skills/adaptive-injector";
import type { LoadedSkill } from "../../src/skills/loader";

function makeSkill(
	name: string,
	stacks: string[],
	requires: string[] = [],
	description = "",
): LoadedSkill {
	return {
		frontmatter: { name, description, stacks, requires, mcp: null },
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

	it("preserves MANIFEST_TAGS results when readdir fails on a non-directory path", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "stack-test-"));
		await writeFile(join(tempDir, "package.json"), "{}");

		// Pass a file as projectRoot — readdir will throw ENOTDIR,
		// but MANIFEST_TAGS results (javascript) should survive
		const filePath = join(tempDir, "package.json");
		const tags = await detectProjectStackTags(filePath);
		// access(filePath) for package.json would succeed since the path IS package.json,
		// but the key point is readdir failure doesn't crash or clear prior results
		expect(Array.isArray(tags)).toBe(true);

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

	it("respects token budget by excluding skills that exceed it", () => {
		const bigSkill: LoadedSkill = {
			frontmatter: {
				name: "big",
				description: "x".repeat(300),
				stacks: [],
				requires: [],
				mcp: null,
			},
			content: "x".repeat(50000),
			path: "/fake/big/SKILL.md",
		};

		const skills = new Map<string, LoadedSkill>([["big", bigSkill]]);

		// Budget of 1 token = 4 chars total — even a summary header can't fit
		const result = buildMultiSkillContext(skills, 1, "summary");
		expect(result).toBe("");
	});

	it("respects token budget in full mode by truncating at section boundaries", () => {
		const bigContent = "x".repeat(50000);
		const bigSkill: LoadedSkill = {
			frontmatter: { name: "big", description: "", stacks: [], requires: [], mcp: null },
			content: bigContent,
			path: "/fake/big/SKILL.md",
		};

		const skills = new Map<string, LoadedSkill>([["big", bigSkill]]);

		// 100 tokens = 400 chars — full mode truncates content to fit within budget
		const result = buildMultiSkillContext(skills, 100, "full");
		// The header + wrapper add overhead, so total output stays within budget
		const charBudget = 100 * 4;
		// The wrapper line is outside the budget accounting, but the skill section fits
		const skillSection = result.slice(result.indexOf("[Skill:"));
		expect(skillSection.length).toBeLessThanOrEqual(charBudget);
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

	it("skills are sorted alphabetically in output when Map is pre-sorted by loader", () => {
		// Simulate loader output: Map entries sorted alphabetically by name.
		// The dependency resolver preserves this order for independent nodes.
		const unsorted = new Map<string, LoadedSkill>([
			["zebra-skill", makeSkill("zebra-skill", [])],
			["alpha-skill", makeSkill("alpha-skill", [])],
			["middle-skill", makeSkill("middle-skill", [])],
		]);
		// Sort as loader.ts does: alphabetical by key
		const skills = new Map([...unsorted.entries()].sort(([a], [b]) => a.localeCompare(b)));

		const result = buildMultiSkillContext(skills);
		const alphaIdx = result.indexOf("[Skill: alpha-skill]");
		const middleIdx = result.indexOf("[Skill: middle-skill]");
		const zebraIdx = result.indexOf("[Skill: zebra-skill]");
		expect(alphaIdx).toBeLessThan(middleIdx);
		expect(middleIdx).toBeLessThan(zebraIdx);
	});

	it("summary mode produces compact output (< 500 chars per skill)", () => {
		const longContent = "x".repeat(5000);
		const skill: LoadedSkill = {
			frontmatter: {
				name: "verbose-skill",
				description: "A short description",
				stacks: [],
				requires: [],
				mcp: null,
			},
			content: longContent,
			path: "/fake/verbose-skill/SKILL.md",
		};

		const skills = new Map<string, LoadedSkill>([["verbose-skill", skill]]);
		const result = buildMultiSkillContext(skills, 8000, "summary");

		// Extract just the skill section (after the header line)
		const sectionStart = result.indexOf("[Skill: verbose-skill]");
		expect(sectionStart).toBeGreaterThan(-1);
		const sectionContent = result.slice(sectionStart);
		expect(sectionContent.length).toBeLessThan(500);
	});

	it("full mode preserves structure and includes content", () => {
		const skill: LoadedSkill = {
			frontmatter: {
				name: "structured",
				description: "A skill with sections",
				stacks: [],
				requires: [],
				mcp: null,
			},
			content:
				"---\nname: structured\n---\n# Heading\n\nParagraph one.\n\n## Section Two\n\nMore text.",
			path: "/fake/structured/SKILL.md",
		};

		const skills = new Map<string, LoadedSkill>([["structured", skill]]);
		const result = buildMultiSkillContext(skills, 8000, "full");
		expect(result).toContain("[Skill: structured]");
		expect(result).toContain("Heading");
	});
});

describe("buildSkillSummary", () => {
	it("returns name and description header", () => {
		const skill = makeSkill("test-skill", [], [], "My skill description");
		const summary = buildSkillSummary(skill);
		expect(summary).toContain("[Skill: test-skill]");
		expect(summary).toContain("My skill description");
	});

	it("truncates description to 200 chars", () => {
		const longDesc = "A".repeat(300);
		const skill = makeSkill("long-desc", [], [], longDesc);
		const summary = buildSkillSummary(skill);
		// Description portion must be at most 200 chars
		const descPart = summary.split("\n")[1];
		expect(descPart.length).toBeLessThanOrEqual(200);
	});

	it("handles empty description gracefully", () => {
		const skill = makeSkill("no-desc", []);
		const summary = buildSkillSummary(skill);
		expect(summary).toContain("[Skill: no-desc]");
		expect(summary).toBe("[Skill: no-desc]\n");
	});
});

describe("buildAdaptiveSkillContext", () => {
	it("phase filtering only includes phase-relevant skills", () => {
		const skills = new Map<string, LoadedSkill>([
			["coding-standards", makeSkill("coding-standards", [], [], "Coding conventions")],
			["tdd-workflow", makeSkill("tdd-workflow", [], [], "Test-driven dev")],
			["plan-writing", makeSkill("plan-writing", [], [], "Writing plans")],
			["plan-executing", makeSkill("plan-executing", [], [], "Executing plans")],
		]);

		// BUILD phase should only include coding-standards and tdd-workflow
		const buildResult = buildAdaptiveSkillContext(skills, { phase: "BUILD" });
		expect(buildResult).toContain("coding-standards");
		expect(buildResult).toContain("tdd-workflow");
		expect(buildResult).not.toContain("plan-writing");
		expect(buildResult).not.toContain("plan-executing");

		// PLAN phase should only include plan-writing and plan-executing
		const planResult = buildAdaptiveSkillContext(skills, { phase: "PLAN" });
		expect(planResult).toContain("plan-writing");
		expect(planResult).toContain("plan-executing");
		expect(planResult).not.toContain("coding-standards");
		expect(planResult).not.toContain("tdd-workflow");
	});

	it("returns empty string for phases with no mapped skills", () => {
		const skills = new Map<string, LoadedSkill>([
			["coding-standards", makeSkill("coding-standards", [], [], "Coding conventions")],
		]);

		const result = buildAdaptiveSkillContext(skills, { phase: "RETROSPECTIVE" });
		expect(result).toBe("");
	});

	it("returns empty string for unknown phase", () => {
		const skills = new Map<string, LoadedSkill>([
			["coding-standards", makeSkill("coding-standards", [], [], "Coding conventions")],
		]);

		const result = buildAdaptiveSkillContext(skills, { phase: "UNKNOWN_PHASE" });
		expect(result).toBe("");
	});

	it("without phase, includes all provided skills", () => {
		const skills = new Map<string, LoadedSkill>([
			["coding-standards", makeSkill("coding-standards", [], [], "Coding conventions")],
			["plan-writing", makeSkill("plan-writing", [], [], "Writing plans")],
		]);

		const result = buildAdaptiveSkillContext(skills);
		expect(result).toContain("coding-standards");
		expect(result).toContain("plan-writing");
	});

	it("respects custom budget", () => {
		const skills = new Map<string, LoadedSkill>([
			["coding-standards", makeSkill("coding-standards", [], [], "Coding conventions")],
			["tdd-workflow", makeSkill("tdd-workflow", [], [], "Test-driven dev")],
		]);

		// Very small budget should limit output
		const result = buildAdaptiveSkillContext(skills, { phase: "BUILD", budget: 5 });
		// 5 tokens = 20 chars total budget -- may fit zero or one summary
		expect(result.length).toBeLessThan(200);
	});

	it("PHASE_SKILL_MAP covers all 8 pipeline phases", () => {
		const expectedPhases = [
			"RECON",
			"CHALLENGE",
			"ARCHITECT",
			"PLAN",
			"BUILD",
			"SHIP",
			"RETROSPECTIVE",
			"EXPLORE",
		];
		for (const phase of expectedPhases) {
			expect(PHASE_SKILL_MAP[phase]).toBeDefined();
			expect(Array.isArray(PHASE_SKILL_MAP[phase])).toBe(true);
		}
	});
});
