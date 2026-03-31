import { describe, expect, it } from "bun:test";
import { type AgentTemplateInput, generateAgentMarkdown } from "../src/templates/agent-template";
import {
	type CommandTemplateInput,
	generateCommandMarkdown,
} from "../src/templates/command-template";
import { generateSkillMarkdown, type SkillTemplateInput } from "../src/templates/skill-template";

describe("generateAgentMarkdown", () => {
	const baseInput: AgentTemplateInput = {
		name: "code-reviewer",
		description: "Reviews code for quality and patterns",
		mode: "subagent",
	};

	it("produces markdown starting with YAML frontmatter delimiters", () => {
		const result = generateAgentMarkdown(baseInput);
		expect(result.startsWith("---\n")).toBe(true);
		expect(result).toContain("\n---\n");
	});

	it("includes description in frontmatter", () => {
		const result = generateAgentMarkdown(baseInput);
		expect(result).toContain("description: Reviews code for quality and patterns");
	});

	it("includes mode in frontmatter", () => {
		const result = generateAgentMarkdown(baseInput);
		expect(result).toContain("mode: subagent");
	});

	it("includes default read-only permissions", () => {
		const result = generateAgentMarkdown(baseInput);
		expect(result).toContain("read: allow");
		expect(result).toContain("edit: deny");
		expect(result).toContain("bash: deny");
		expect(result).toContain("webfetch: deny");
		expect(result).toContain("task: deny");
	});

	it("includes model when provided", () => {
		const input: AgentTemplateInput = {
			...baseInput,
			model: "anthropic/claude-sonnet-4-20250514",
		};
		const result = generateAgentMarkdown(input);
		expect(result).toContain("model: anthropic/claude-sonnet-4-20250514");
	});

	it("omits model when not provided (model agnosticism)", () => {
		const result = generateAgentMarkdown(baseInput);
		expect(result).not.toContain("model:");
	});

	it("includes temperature when provided", () => {
		const input: AgentTemplateInput = {
			...baseInput,
			temperature: 0.3,
		};
		const result = generateAgentMarkdown(input);
		expect(result).toContain("temperature: 0.3");
	});

	it("omits temperature when not provided", () => {
		const result = generateAgentMarkdown(baseInput);
		expect(result).not.toContain("temperature:");
	});

	it("uses custom permissions when provided", () => {
		const input: AgentTemplateInput = {
			...baseInput,
			permission: {
				read: "allow",
				edit: "allow",
				bash: "ask",
				webfetch: "deny",
				task: "deny",
			},
		};
		const result = generateAgentMarkdown(input);
		expect(result).toContain("edit: allow");
		expect(result).toContain("bash: ask");
	});

	it("includes placeholder prompt body with agent name", () => {
		const result = generateAgentMarkdown(baseInput);
		expect(result).toContain("You are code-reviewer, an AI agent.");
	});

	it("includes Role and Instructions sections", () => {
		const result = generateAgentMarkdown(baseInput);
		expect(result).toContain("## Role");
		expect(result).toContain("## Instructions");
	});

	it("includes TODO guidance comments", () => {
		const result = generateAgentMarkdown(baseInput);
		expect(result).toContain("TODO");
	});

	it("handles special characters in description", () => {
		const input: AgentTemplateInput = {
			...baseInput,
			description: 'Reviews code: "quality" & patterns',
		};
		const result = generateAgentMarkdown(input);
		// YAML stringify should handle the special chars properly
		expect(result).toContain("Reviews code");
		// Should still be valid frontmatter (starts and ends correctly)
		expect(result.startsWith("---\n")).toBe(true);
	});

	it("uses yaml.stringify for frontmatter (not string concatenation)", () => {
		// If using yaml.stringify, the permission object will be properly nested
		const result = generateAgentMarkdown(baseInput);
		expect(result).toContain("permission:");
		// YAML stringify produces nested structure with indentation
		expect(result).toMatch(/permission:\n\s+read: allow/);
	});
});

describe("generateSkillMarkdown", () => {
	const baseInput: SkillTemplateInput = {
		name: "my-skill",
		description: "Does useful things",
	};

	it("produces markdown starting with YAML frontmatter delimiters", () => {
		const result = generateSkillMarkdown(baseInput);
		expect(result.startsWith("---\n")).toBe(true);
		expect(result).toContain("\n---\n");
	});

	it("includes name in frontmatter", () => {
		const result = generateSkillMarkdown(baseInput);
		expect(result).toContain("name: my-skill");
	});

	it("includes description in frontmatter", () => {
		const result = generateSkillMarkdown(baseInput);
		expect(result).toContain("description: Does useful things");
	});

	it("includes all required sections", () => {
		const result = generateSkillMarkdown(baseInput);
		expect(result).toContain("## What I do");
		expect(result).toContain("## Rules");
		expect(result).toContain("## Examples");
	});

	it("includes license when provided", () => {
		const input: SkillTemplateInput = {
			...baseInput,
			license: "MIT",
		};
		const result = generateSkillMarkdown(input);
		expect(result).toContain("license: MIT");
	});

	it("omits license when not provided", () => {
		const result = generateSkillMarkdown(baseInput);
		expect(result).not.toContain("license:");
	});

	it("includes compatibility when provided", () => {
		const input: SkillTemplateInput = {
			...baseInput,
			compatibility: "opencode",
		};
		const result = generateSkillMarkdown(input);
		expect(result).toContain("compatibility: opencode");
	});

	it("omits compatibility when not provided", () => {
		const result = generateSkillMarkdown(baseInput);
		expect(result).not.toContain("compatibility:");
	});

	it("handles special characters in description", () => {
		const input: SkillTemplateInput = {
			...baseInput,
			description: 'Handles: "edge cases" & more',
		};
		const result = generateSkillMarkdown(input);
		expect(result.startsWith("---\n")).toBe(true);
		expect(result).toContain("edge cases");
	});

	it("has placeholder content in body sections", () => {
		const result = generateSkillMarkdown(baseInput);
		// Body should have some guidance text in sections
		const afterFrontmatter = result.split("---\n").slice(2).join("---\n");
		expect(afterFrontmatter.trim().length).toBeGreaterThan(50);
	});
});

describe("generateCommandMarkdown", () => {
	const baseInput: CommandTemplateInput = {
		name: "review",
		description: "Reviews code changes",
	};

	it("produces markdown starting with YAML frontmatter delimiters", () => {
		const result = generateCommandMarkdown(baseInput);
		expect(result.startsWith("---\n")).toBe(true);
		expect(result).toContain("\n---\n");
	});

	it("includes description in frontmatter", () => {
		const result = generateCommandMarkdown(baseInput);
		expect(result).toContain("description: Reviews code changes");
	});

	it("does not include name in frontmatter", () => {
		const result = generateCommandMarkdown(baseInput);
		// name is used for the filename, not in frontmatter
		const frontmatter = result.split("---\n")[1];
		expect(frontmatter).not.toContain("name:");
	});

	it("includes $ARGUMENTS placeholder in body", () => {
		const result = generateCommandMarkdown(baseInput);
		expect(result).toContain("$ARGUMENTS");
	});

	it("includes agent when provided", () => {
		const input: CommandTemplateInput = {
			...baseInput,
			agent: "code-reviewer",
		};
		const result = generateCommandMarkdown(input);
		expect(result).toContain("agent: code-reviewer");
	});

	it("omits agent when not provided", () => {
		const result = generateCommandMarkdown(baseInput);
		expect(result).not.toContain("agent:");
	});

	it("includes model when provided", () => {
		const input: CommandTemplateInput = {
			...baseInput,
			model: "anthropic/claude-sonnet-4-20250514",
		};
		const result = generateCommandMarkdown(input);
		expect(result).toContain("model: anthropic/claude-sonnet-4-20250514");
	});

	it("omits model when not provided", () => {
		const result = generateCommandMarkdown(baseInput);
		expect(result).not.toContain("model:");
	});

	it("handles special characters in description", () => {
		const input: CommandTemplateInput = {
			...baseInput,
			description: 'Run: "tests" & linting',
		};
		const result = generateCommandMarkdown(input);
		expect(result.startsWith("---\n")).toBe(true);
		expect(result).toContain("tests");
	});

	it("includes usage guidance text", () => {
		const result = generateCommandMarkdown(baseInput);
		const body = result.split("---\n").slice(2).join("---\n");
		expect(body.trim().length).toBeGreaterThan(20);
	});
});
