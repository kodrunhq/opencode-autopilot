import { type ToolDefinition, tool } from "@opencode-ai/plugin/tool";
import { withLspClient } from "./lsp-client-wrapper";
import { formatApplyResult, formatPrepareRenameResult } from "./lsp-formatters";
import type { PrepareRenameDefaultBehavior, PrepareRenameResult, WorkspaceEdit } from "./types";
import { applyWorkspaceEdit } from "./workspace-edit";

export const ocLspPrepareRename: ToolDefinition = tool({
	description: "Check if rename is valid. Use BEFORE lsp_rename.",
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
					client.prepareRename(args.filePath, args.line, args.character) as Promise<
						PrepareRenameResult | PrepareRenameDefaultBehavior | null
					>,
				"rename",
			);
			return formatPrepareRenameResult(result);
		} catch (error) {
			return `Error: ${error instanceof Error ? error.message : String(error)}`;
		}
	},
});

export const ocLspRename: ToolDefinition = tool({
	description: "Rename symbol across entire workspace. APPLIES changes to all files.",
	args: {
		character: tool.schema.number().min(0).describe("0-based"),
		filePath: tool.schema.string(),
		line: tool.schema.number().min(1).describe("1-based"),
		newName: tool.schema.string().describe("New symbol name"),
	},
	async execute(args) {
		try {
			const edit = await withLspClient(
				args.filePath,
				(client) =>
					client.rename(
						args.filePath,
						args.line,
						args.character,
						args.newName,
					) as Promise<WorkspaceEdit | null>,
				"rename",
			);
			return formatApplyResult(await applyWorkspaceEdit(edit));
		} catch (error) {
			return `Error: ${error instanceof Error ? error.message : String(error)}`;
		}
	},
});
