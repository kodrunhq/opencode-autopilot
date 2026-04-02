import { execFile as execFileCb } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";
import { tool } from "@opencode-ai/plugin";

const execFile = promisify(execFileCb);

interface UpdateDocsArgs {
	readonly scope?: string;
}

interface AffectedDoc {
	readonly doc: string;
	readonly reason: string;
	readonly suggestion: string;
}

/** Run a git command and return stdout lines (empty array on error). */
async function gitLines(args: readonly string[], cwd: string): Promise<readonly string[]> {
	try {
		const { stdout } = await execFile("git", args as string[], { cwd });
		return stdout
			.trim()
			.split("\n")
			.filter((line) => line.length > 0);
	} catch {
		return [];
	}
}

export async function updateDocsCore(args: UpdateDocsArgs, projectDir: string): Promise<string> {
	const scope = args.scope ?? "changed";

	// Get changed source files
	const changedFiles: readonly string[] =
		scope === "all"
			? await gitLines(["ls-files"], projectDir)
			: await gitLines(["diff", "--name-only", "HEAD"], projectDir);

	// Get all markdown files in the project
	const mdFiles = await gitLines(["ls-files", "*.md"], projectDir);

	// For each changed source file, check if any markdown file references it
	const affectedDocs: AffectedDoc[] = [];
	const seenDocs = new Set<string>();

	for (const changedFile of changedFiles) {
		// Skip markdown files themselves
		if (changedFile.endsWith(".md")) continue;

		const fileBaseName = basename(changedFile);
		// Strip extension for module-style references
		const moduleName = fileBaseName.replace(/\.[^.]+$/, "");

		for (const mdFile of mdFiles) {
			if (seenDocs.has(`${mdFile}:${changedFile}`)) continue;

			// Simple heuristic: check if the markdown file path suggests it documents this area
			// or if the changed file's name/module appears in common documentation patterns
			const mdBaseName = basename(mdFile).replace(/\.md$/, "").toLowerCase();
			const changedDir = changedFile.split("/").slice(0, -1).join("/");

			const isRelated =
				mdBaseName === "readme" ||
				mdBaseName === moduleName.toLowerCase() ||
				(changedDir.length > 0 && mdFile.toLowerCase().includes(changedDir.toLowerCase()));

			if (isRelated) {
				seenDocs.add(`${mdFile}:${changedFile}`);
				affectedDocs.push({
					doc: mdFile,
					reason: `references ${changedFile} which changed`,
					suggestion: `Review and update documentation in ${mdFile} to reflect changes to ${changedFile}`,
				});
			}
		}
	}

	// Deduplicate by doc path
	const uniqueDocs = Array.from(
		affectedDocs.reduce(
			(map, item) => {
				if (!map.has(item.doc)) {
					map.set(item.doc, item);
				}
				return map;
			},
			new Map<string, AffectedDoc>(),
		).values(),
	);

	const nonMdChanged = changedFiles.filter((f) => !f.endsWith(".md"));

	return JSON.stringify(
		{
			changedFiles: nonMdChanged,
			affectedDocs: uniqueDocs,
			summary: `${nonMdChanged.length} source files changed, ${uniqueDocs.length} docs may need updates`,
		},
		null,
		2,
	);
}

export const ocUpdateDocs = tool({
	description:
		"Detect documentation affected by recent code changes and suggest updates.",
	args: {
		scope: tool.schema
			.enum(["changed", "all"])
			.optional()
			.default("changed")
			.describe("Scope: 'changed' for git diff, 'all' for full scan"),
	},
	async execute(args) {
		return updateDocsCore(args, process.cwd());
	},
});
