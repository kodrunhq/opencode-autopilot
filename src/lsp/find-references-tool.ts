import { type ToolDefinition, tool } from "@opencode-ai/plugin/tool";
import { DEFAULT_MAX_REFERENCES } from "./constants";
import { withLspClient } from "./lsp-client-wrapper";
import { formatLocation } from "./lsp-formatters";
import type { Location } from "./types";

export const ocLspFindReferences: ToolDefinition = tool({
	description: "Find ALL usages/references of a symbol across the entire workspace.",
	args: {
		character: tool.schema.number().min(0).describe("0-based"),
		filePath: tool.schema.string(),
		includeDeclaration: tool.schema.boolean().optional().describe("Include the declaration itself"),
		line: tool.schema.number().min(1).describe("1-based"),
	},
	async execute(args) {
		try {
			const references = await withLspClient(
				args.filePath,
				(client) =>
					client.references(
						args.filePath,
						args.line,
						args.character,
						args.includeDeclaration ?? true,
					) as Promise<readonly Location[] | null>,
				"references",
			);
			if (!references || references.length === 0) return "No references found";
			const limited = references.slice(0, DEFAULT_MAX_REFERENCES);
			const lines = limited.map((reference) => formatLocation(reference));
			if (references.length > DEFAULT_MAX_REFERENCES)
				lines.unshift(
					`Found ${references.length} references (showing first ${DEFAULT_MAX_REFERENCES}):`,
				);
			return lines.join("\n");
		} catch (error) {
			return `Error: ${error instanceof Error ? error.message : String(error)}`;
		}
	},
});
