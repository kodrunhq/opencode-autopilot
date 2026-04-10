/**
 * oc_graph_index tool — index project files into the code graph.
 *
 * @module
 */

import { tool } from "@opencode-ai/plugin";
import { indexProject } from "../graph/indexer";
import { openKernelDb } from "../kernel/database";
import { resolveProjectIdentitySync } from "../projects/resolve";
import { getProjectArtifactDir } from "../utils/paths";

interface GraphIndexArgs {
	readonly projectRoot?: string;
	readonly files?: readonly string[];
	readonly force?: boolean;
}

export async function graphIndexCore(args: GraphIndexArgs): Promise<{
	ok: boolean;
	result?: Record<string, unknown>;
	error?: string;
}> {
	try {
		const projectRoot = args.projectRoot ?? process.cwd();
		const db = openKernelDb(getProjectArtifactDir(projectRoot));

		const resolved = resolveProjectIdentitySync(projectRoot, {
			db,
			allowCreate: true,
		});
		const projectId = resolved.id.startsWith("project:") ? null : resolved.id;

		if (!projectId) {
			db.close();
			return {
				ok: false,
				error:
					"Cannot index: no known project identity for current directory. Run from a project root.",
			};
		}

		const files = args.files ?? [];
		const force = args.force ?? false;

		if (files.length === 0 && !force) {
			db.close();
			return {
				ok: true,
				result: {
					message:
						"No files specified. Pass a list of relative file paths to index, or set force=true to clear the index.",
				},
			};
		}

		const indexResult = await indexProject(db, projectId, projectRoot, files, { force });

		db.close();

		return {
			ok: true,
			result: {
				projectId,
				filesIndexed: indexResult.filesIndexed,
				filesRemoved: indexResult.filesRemoved,
				filesSkipped: indexResult.filesSkipped,
				errors: indexResult.errors,
			},
		};
	} catch (error: unknown) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export const ocGraphIndex = tool({
	description:
		"Index TypeScript/JavaScript files into the local code graph for fast symbol and dependency retrieval. Complements oc_lsp_* tools for broad discovery.",
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
	async execute(args) {
		return JSON.stringify(await graphIndexCore(args), null, 2);
	},
});
