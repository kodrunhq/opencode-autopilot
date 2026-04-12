/**
 * oc_graph_query tool — query the local code graph.
 *
 * @module
 */

import { tool } from "@opencode-ai/plugin";
import { findDefinitions, findDependents, findImports, getModuleOutline } from "../graph/query";
import { openProjectKernelDb } from "../kernel/database";
import { resolveProjectIdentitySync } from "../projects/resolve";

interface GraphQueryArgs {
	readonly action: "find_definitions" | "find_imports" | "find_dependents" | "get_outline";
	readonly name?: string;
	readonly filePath?: string;
	readonly projectRoot?: string;
}

export async function graphQueryCore(args: GraphQueryArgs): Promise<{
	ok: boolean;
	data?: Record<string, unknown>;
	error?: string;
}> {
	try {
		const projectRoot = args.projectRoot ?? process.cwd();
		const db = openProjectKernelDb(projectRoot, { readonly: true });

		const resolved = resolveProjectIdentitySync(projectRoot, {
			db,
			allowCreate: false,
		});
		const projectId = resolved.id.startsWith("project:") ? null : resolved.id;

		if (!projectId) {
			db.close();
			return {
				ok: false,
				error: "Cannot query: no known project identity. Run from a project root.",
			};
		}

		let result: Record<string, unknown>;

		switch (args.action) {
			case "find_definitions": {
				if (!args.name) {
					db.close();
					return { ok: false, error: "name is required for find_definitions" };
				}
				const queryResult = await findDefinitions(db, projectId, projectRoot, args.name);
				db.close();
				result = {
					action: args.action,
					name: args.name,
					definitions: queryResult.data,
					stale: queryResult.stale,
					staleFiles: queryResult.staleFiles,
					fallbackHint: queryResult.fallbackHint,
				};
				break;
			}
			case "find_imports": {
				if (!args.filePath) {
					db.close();
					return { ok: false, error: "filePath is required for find_imports" };
				}
				const queryResult = await findImports(db, projectId, projectRoot, args.filePath);
				db.close();
				result = {
					action: args.action,
					filePath: args.filePath,
					imports: queryResult.data,
					stale: queryResult.stale,
					staleFiles: queryResult.staleFiles,
					fallbackHint: queryResult.fallbackHint,
				};
				break;
			}
			case "find_dependents": {
				if (!args.filePath) {
					db.close();
					return { ok: false, error: "filePath is required for find_dependents" };
				}
				const queryResult = await findDependents(db, projectId, projectRoot, args.filePath);
				db.close();
				result = {
					action: args.action,
					filePath: args.filePath,
					dependents: queryResult.data,
					stale: queryResult.stale,
					staleFiles: queryResult.staleFiles,
					fallbackHint: queryResult.fallbackHint,
				};
				break;
			}
			case "get_outline": {
				if (!args.filePath) {
					db.close();
					return { ok: false, error: "filePath is required for get_outline" };
				}
				const queryResult = await getModuleOutline(db, projectId, projectRoot, args.filePath);
				db.close();
				result = {
					action: args.action,
					filePath: args.filePath,
					symbols: queryResult.data,
					stale: queryResult.stale,
					staleFiles: queryResult.staleFiles,
					fallbackHint: queryResult.fallbackHint,
				};
				break;
			}
			default:
				db.close();
				return { ok: false, error: `Unknown action: ${args.action}` };
		}

		return { ok: true, data: result };
	} catch (error: unknown) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export const ocGraphQuery = tool({
	description:
		"Query the local code graph for symbol definitions, imports, dependents, or file outlines. Complements oc_lsp_* tools for broad discovery.",
	args: {
		action: tool.schema
			.enum(["find_definitions", "find_imports", "find_dependents", "get_outline"])
			.describe("Query action to perform"),
		name: tool.schema.string().optional().describe("Symbol name (required for find_definitions)"),
		filePath: tool.schema
			.string()
			.optional()
			.describe("Relative file path (required for find_imports, find_dependents, get_outline)"),
		projectRoot: tool.schema
			.string()
			.optional()
			.describe("Project root directory (defaults to cwd)"),
	},
	async execute(args) {
		return JSON.stringify(await graphQueryCore(args), null, 2);
	},
});
