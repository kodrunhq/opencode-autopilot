import { tool } from "@opencode-ai/plugin";

export const ocGraphIndexLazy = tool({
	description:
		"Index TypeScript/JavaScript files into the local code graph for fast symbol and dependency retrieval",
	args: {
		projectRoot: tool.schema
			.string()
			.optional()
			.describe("Project root directory (defaults to cwd)"),
		files: tool.schema
			.array(tool.schema.string())
			.optional()
			.describe("List of relative file paths to index"),
		force: tool.schema
			.boolean()
			.default(false)
			.describe("Force full reindex (clears existing graph data)"),
	},
	async execute(args, context) {
		const { ocGraphIndex } = await import("./graph-index");
		return ocGraphIndex.execute(args, context);
	},
});

export const ocGraphQueryLazy = tool({
	description: "Query the local code graph for definitions, imports, dependents, and file outlines",
	args: {
		action: tool.schema
			.enum(["find_definitions", "find_imports", "find_dependents", "get_outline"])
			.describe("Query action to perform"),
		name: tool.schema.string().optional().describe("Symbol name to search for"),
		filePath: tool.schema.string().optional().describe("File path to search in"),
		projectRoot: tool.schema
			.string()
			.optional()
			.describe("Project root directory (defaults to cwd)"),
	},
	async execute(args, context) {
		const { ocGraphQuery } = await import("./graph-query");
		return ocGraphQuery.execute(args, context);
	},
});
