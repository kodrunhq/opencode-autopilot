import { resolve } from "node:path";
import { type ToolDefinition, tool } from "@opencode-ai/plugin/tool";
import { MAX_DIAGNOSTICS } from "./constants";
import { aggregateDiagnosticsForDirectory } from "./directory-diagnostics";
import { inferExtensionFromDirectory } from "./infer-extension";
import { isDirectoryPath, withLspClient } from "./lsp-client-wrapper";
import { filterDiagnosticsBySeverity, formatDiagnostic } from "./lsp-formatters";
import type { Diagnostic } from "./types";

function extractDiagnostics(
	result: { readonly items?: readonly Diagnostic[] } | readonly Diagnostic[] | null,
): readonly Diagnostic[] {
	if (!result) return [];
	if (Array.isArray(result)) return result;
	return "items" in result ? (result.items ?? []) : [];
}

export const ocLspDiagnostics: ToolDefinition = tool({
	description:
		"Get errors, warnings, hints from language server BEFORE running build. Works for both single files and directories - file extension is auto-detected for directories.",
	args: {
		filePath: tool.schema.string().describe("File or directory path to check diagnostics for"),
		severity: tool.schema
			.enum(["error", "warning", "information", "hint", "all"])
			.optional()
			.describe("Filter by severity level"),
	},
	async execute(args) {
		try {
			const absolutePath = resolve(args.filePath);
			if (isDirectoryPath(absolutePath)) {
				const extension = inferExtensionFromDirectory(absolutePath);
				if (!extension)
					throw new Error(`No supported source files found in directory: ${absolutePath}`);
				return aggregateDiagnosticsForDirectory(absolutePath, extension, args.severity);
			}
			const result = await withLspClient(
				args.filePath,
				(client) =>
					client.diagnostics(args.filePath) as Promise<
						{ readonly items?: readonly Diagnostic[] } | readonly Diagnostic[] | null
					>,
			);
			const diagnostics = filterDiagnosticsBySeverity(extractDiagnostics(result), args.severity);
			if (diagnostics.length === 0) return "No diagnostics found";
			const lines = diagnostics
				.slice(0, MAX_DIAGNOSTICS)
				.map((diagnostic) => formatDiagnostic(diagnostic));
			if (diagnostics.length > MAX_DIAGNOSTICS)
				lines.unshift(
					`Found ${diagnostics.length} diagnostics (showing first ${MAX_DIAGNOSTICS}):`,
				);
			return lines.join("\n");
		} catch (error) {
			return `Error: ${error instanceof Error ? error.message : String(error)}`;
		}
	},
});
