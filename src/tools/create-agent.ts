import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { generateAgentMarkdown } from "../templates/agent-template";
import { ensureDir, fileExists } from "../utils/fs-helpers";
import { getGlobalConfigDir } from "../utils/paths";
import { validateAssetName } from "../utils/validators";

interface CreateAgentArgs {
	readonly name: string;
	readonly description: string;
	readonly mode: "primary" | "subagent" | "all";
	readonly model?: string;
	readonly temperature?: number;
}

export async function createAgentCore(args: CreateAgentArgs, baseDir: string): Promise<string> {
	const validation = validateAssetName(args.name);
	if (!validation.valid) {
		return `Error: ${validation.error}`;
	}

	const agentsDir = join(baseDir, "agents");
	const filePath = join(agentsDir, `${args.name}.md`);

	if (await fileExists(filePath)) {
		return `Error: Agent '${args.name}' already exists at ${filePath}. Choose a different name or delete the existing file first.`;
	}

	const markdown = generateAgentMarkdown({
		name: args.name,
		description: args.description,
		mode: args.mode,
		model: args.model,
		temperature: args.temperature,
	});

	await ensureDir(agentsDir);
	await writeFile(filePath, markdown, "utf-8");

	return `Agent '${args.name}' created at ${filePath}. Restart OpenCode to use it.`;
}

export const ocCreateAgent = tool({
	description:
		"Create a new OpenCode agent. Writes a properly-formatted agent markdown file to ~/.config/opencode/agents/.",
	args: {
		name: tool.schema
			.string()
			.min(1)
			.max(64)
			.describe("Agent name (e.g., 'code-reviewer'). Lowercase alphanumeric with hyphens."),
		description: tool.schema.string().min(1).max(500).describe("What the agent does"),
		mode: tool.schema
			.enum(["primary", "subagent", "all"])
			.default("subagent")
			.describe("Agent mode: primary (main agent), subagent (invoked via @mention), or all (both)"),
		model: tool.schema.string().optional().describe("Model identifier (omit for model-agnostic)"),
		temperature: tool.schema
			.number()
			.min(0)
			.max(1)
			.optional()
			.describe("Temperature 0.0-1.0 (omit for default)"),
	},
	async execute(args) {
		return createAgentCore(args, getGlobalConfigDir());
	},
});
