import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { generateCommandMarkdown } from "../templates/command-template";
import { ensureDir } from "../utils/fs-helpers";
import { getGlobalConfigDir } from "../utils/paths";
import { validateCommandName } from "../utils/validators";

interface CreateCommandArgs {
	readonly name: string;
	readonly description: string;
	readonly agent?: string;
	readonly model?: string;
}

export async function createCommandCore(args: CreateCommandArgs, baseDir: string): Promise<string> {
	const validation = validateCommandName(args.name);
	if (!validation.valid) {
		return `Error: ${validation.error}`;
	}

	const commandsDir = join(baseDir, "commands");
	const filePath = join(commandsDir, `${args.name}.md`);

	const markdown = generateCommandMarkdown({
		name: args.name,
		description: args.description,
		agent: args.agent,
		model: args.model,
	});

	try {
		await ensureDir(commandsDir);
		await writeFile(filePath, markdown, { encoding: "utf-8", flag: "wx" });
	} catch (error) {
		if (
			error instanceof Error &&
			"code" in error &&
			(error as NodeJS.ErrnoException).code === "EEXIST"
		) {
			return `Error: Command '${args.name}' already exists at ${filePath}. Choose a different name or delete the existing file first.`;
		}
		const message = error instanceof Error ? error.message : String(error);
		return `Error: Failed to write command: ${message}`;
	}

	return `Command '${args.name}' created at ${filePath}. Restart OpenCode to use it.`;
}

export const ocCreateCommand = tool({
	description:
		"Create a new OpenCode command. Writes a command markdown file to ~/.config/opencode/commands/.",
	args: {
		name: tool.schema
			.string()
			.min(1)
			.max(64)
			.describe("Command name (e.g., 'review'). Lowercase alphanumeric with hyphens."),
		description: tool.schema
			.string()
			.min(1)
			.max(500)
			.describe("What the command does when invoked"),
		agent: tool.schema
			.string()
			.max(64)
			.optional()
			.describe("Agent to use when running this command (e.g., 'code-reviewer')"),
		model: tool.schema.string().max(128).optional().describe("Model override for this command"),
	},
	async execute(args) {
		return createCommandCore(args, getGlobalConfigDir());
	},
});
