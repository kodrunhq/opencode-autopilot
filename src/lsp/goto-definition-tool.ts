import { type ToolDefinition, tool } from "@opencode-ai/plugin/tool";
import { withLspClient } from "./lsp-client-wrapper";
import { formatLocation } from "./lsp-formatters";
import type { Location, LocationLink } from "./types";

export const ocLspGotoDefinition: ToolDefinition = tool({
	description: "Jump to symbol definition. Find WHERE something is defined.",
	args: {
		character: tool.schema.number().min(0).describe("0-based"),
		filePath: tool.schema.string(),
		line: tool.schema.number().min(1).describe("1-based"),
	},
	async execute(args) {
		try {
			const result = await withLspClient(
				args.filePath,
				(client) =>
					client.definition(args.filePath, args.line, args.character) as Promise<
						Location | readonly Location[] | readonly LocationLink[] | null
					>,
				"definition",
			);
			const locations = result ? (Array.isArray(result) ? result : [result]) : [];
			return locations.length > 0
				? locations.map((location) => formatLocation(location)).join("\n")
				: "No definition found";
		} catch (error) {
			return `Error: ${error instanceof Error ? error.message : String(error)}`;
		}
	},
});
