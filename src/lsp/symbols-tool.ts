import { type ToolDefinition, tool } from "@opencode-ai/plugin/tool";
import { MAX_SYMBOLS } from "./constants";
import { withLspClient } from "./lsp-client-wrapper";
import { formatDocumentSymbol, formatSymbolInfo } from "./lsp-formatters";
import type { DocumentSymbol, SymbolInfo } from "./types";

export const ocLspSymbols: ToolDefinition = tool({
	description:
		"Get symbols from file (document) or search across workspace. Use scope='document' for file outline, scope='workspace' for project-wide symbol search.",
	args: {
		filePath: tool.schema.string().describe("File path for LSP context"),
		limit: tool.schema.number().optional().describe("Max results (default 50)"),
		query: tool.schema
			.string()
			.optional()
			.describe("Symbol name to search (required for workspace scope)"),
		scope: tool.schema
			.enum(["document", "workspace"])
			.default("document")
			.describe("'document' for file symbols, 'workspace' for project-wide search"),
	},
	async execute(args) {
		try {
			const limit = Math.min(args.limit ?? MAX_SYMBOLS, MAX_SYMBOLS);
			if (args.scope === "workspace") {
				if (!args.query) return "Error: 'query' is required for workspace scope";
				const symbols = await withLspClient(
					args.filePath,
					(client) =>
						client.workspaceSymbols(args.query ?? "") as Promise<readonly SymbolInfo[] | null>,
				);
				if (!symbols || symbols.length === 0) return "No symbols found";
				const lines = symbols.slice(0, limit).map((symbol) => formatSymbolInfo(symbol));
				if (symbols.length > limit)
					lines.unshift(`Found ${symbols.length} symbols (showing first ${limit}):`);
				return lines.join("\n");
			}
			const symbols = await withLspClient(
				args.filePath,
				(client) =>
					client.documentSymbols(args.filePath) as Promise<
						readonly DocumentSymbol[] | readonly SymbolInfo[] | null
					>,
			);
			if (!symbols || symbols.length === 0) return "No symbols found";
			const limited = symbols.slice(0, limit);
			const lines =
				symbols.length > limit ? [`Found ${symbols.length} symbols (showing first ${limit}):`] : [];
			lines.push(
				...("range" in limited[0]
					? (limited as readonly DocumentSymbol[]).map((symbol) => formatDocumentSymbol(symbol))
					: (limited as readonly SymbolInfo[]).map((symbol) => formatSymbolInfo(symbol))),
			);
			return lines.join("\n");
		} catch (error) {
			return `Error: ${error instanceof Error ? error.message : String(error)}`;
		}
	},
});
