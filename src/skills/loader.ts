/**
 * Skill frontmatter parser and file loader.
 *
 * Loads SKILL.md files from the global skills directory, parses their
 * YAML frontmatter, and returns structured skill metadata + content.
 * Uses the `yaml` package for parsing (not regex — per "Don't Hand-Roll" guideline).
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { skillMcpConfigSchema } from "../mcp/types";
import { isEnoentError } from "../utils/fs-helpers";

export interface SkillFrontmatter {
	readonly name: string;
	readonly description: string;
	readonly stacks: readonly string[];
	readonly requires: readonly string[];
	readonly mcp: import("../mcp/types").SkillMcpConfig | null;
}

export interface LoadedSkill {
	readonly frontmatter: SkillFrontmatter;
	readonly content: string;
	readonly path: string;
}

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Returns null if no valid frontmatter block is found or parsing fails.
 */
export function parseSkillFrontmatter(content: string): SkillFrontmatter | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;

	try {
		const parsed = parse(match[1]);
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
		const fm = parsed as Record<string, unknown>;
		const parsedMcp = fm.mcp === undefined ? null : skillMcpConfigSchema.safeParse(fm.mcp);
		return {
			name: typeof fm.name === "string" ? fm.name : "",
			description: typeof fm.description === "string" ? fm.description : "",
			stacks: Array.isArray(fm.stacks)
				? fm.stacks.filter((s): s is string => typeof s === "string")
				: [],
			requires: Array.isArray(fm.requires)
				? fm.requires.filter((s): s is string => typeof s === "string")
				: [],
			mcp: parsedMcp?.success === true ? parsedMcp.data : null,
		};
	} catch {
		return null;
	}
}

/**
 * Load all skills from a base directory (e.g., ~/.config/opencode/skills/).
 * Returns a map of skill name -> LoadedSkill. Best-effort: skips invalid skills.
 */
export async function loadAllSkills(skillsDir: string): Promise<ReadonlyMap<string, LoadedSkill>> {
	const skills = new Map<string, LoadedSkill>();

	try {
		const entries = await readdir(skillsDir, { withFileTypes: true });
		await Promise.all(
			entries
				.filter((e) => e.isDirectory() && e.name !== ".gitkeep")
				.map(async (dir) => {
					try {
						const skillPath = join(skillsDir, dir.name, "SKILL.md");
						const content = await readFile(skillPath, "utf-8");
						const fm = parseSkillFrontmatter(content);
						if (fm?.name) {
							skills.set(fm.name, { frontmatter: fm, content, path: skillPath });
						}
					} catch (error: unknown) {
						// Skip ENOENT/IO errors (expected for invalid skills)
						if (!isEnoentError(error) && !(error instanceof SyntaxError)) {
							const errObj = error as { code?: unknown };
							if (typeof errObj?.code !== "string") throw error;
						}
					}
				}),
		);
	} catch (error: unknown) {
		if (!isEnoentError(error)) throw error;
	}

	// Sort alphabetically by name for deterministic ordering regardless of
	// filesystem readdir order (which varies across OS and FS types).
	const sorted = new Map([...skills.entries()].sort(([a], [b]) => a.localeCompare(b)));
	return Object.freeze(sorted);
}
