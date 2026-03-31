import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { generateSkillMarkdown } from "../templates/skill-template";
import { ensureDir } from "../utils/fs-helpers";
import { getGlobalConfigDir } from "../utils/paths";
import { validateAssetName } from "../utils/validators";

interface CreateSkillArgs {
	readonly name: string;
	readonly description: string;
	readonly license?: string;
	readonly compatibility?: string;
}

export async function createSkillCore(args: CreateSkillArgs, baseDir: string): Promise<string> {
	const validation = validateAssetName(args.name);
	if (!validation.valid) {
		return `Error: ${validation.error}`;
	}

	const skillDir = join(baseDir, "skills", args.name);
	const filePath = join(skillDir, "SKILL.md");

	const markdown = generateSkillMarkdown({
		name: args.name,
		description: args.description,
		license: args.license,
		compatibility: args.compatibility,
	});

	try {
		await ensureDir(skillDir);
		await writeFile(filePath, markdown, { encoding: "utf-8", flag: "wx" });
	} catch (error) {
		if (
			error instanceof Error &&
			"code" in error &&
			(error as NodeJS.ErrnoException).code === "EEXIST"
		) {
			return `Error: Skill '${args.name}' already exists at ${filePath}. Choose a different name or delete the existing skill directory first.`;
		}
		const message = error instanceof Error ? error.message : String(error);
		return `Error: Failed to write skill: ${message}`;
	}

	return `Skill '${args.name}' created at ${filePath}. Restart OpenCode to use it.`;
}

export const ocCreateSkill = tool({
	description:
		"Create a new OpenCode skill. Writes a SKILL.md file to ~/.config/opencode/skills/<name>/.",
	args: {
		name: tool.schema
			.string()
			.min(1)
			.max(64)
			.describe("Skill name (1-64 chars, lowercase with hyphens, e.g., 'typescript-patterns')"),
		description: tool.schema
			.string()
			.min(1)
			.max(1024)
			.describe("What the skill provides to the AI agent"),
		license: tool.schema.string().max(64).optional().describe("License (e.g., 'MIT')"),
		compatibility: tool.schema
			.string()
			.max(64)
			.optional()
			.describe("Compatibility (e.g., 'opencode')"),
	},
	async execute(args) {
		return createSkillCore(args, getGlobalConfigDir());
	},
});
