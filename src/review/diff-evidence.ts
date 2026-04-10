import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DiffEvidence {
	readonly diff: string;
	readonly changedFiles: readonly string[];
	readonly truncated: boolean;
}

const MAX_DIFF_SIZE = 50_000;

export type ReviewScope = "staged" | "unstaged" | "branch" | "all" | "directory";

function getDiffArgs(scope: ReviewScope, directory?: string): string[] {
	switch (scope) {
		case "staged":
			return ["diff", "--cached"];
		case "unstaged":
			return ["diff"];
		case "branch":
			return ["diff", "HEAD"];
		case "directory":
			return directory ? ["diff", "HEAD", "--", directory] : ["diff", "HEAD"];
		case "all":
			return ["diff", "HEAD"];
	}
}

function getNameOnlyArgs(scope: ReviewScope, directory?: string): string[] {
	switch (scope) {
		case "staged":
			return ["diff", "--cached", "--name-only"];
		case "unstaged":
			return ["diff", "--name-only"];
		case "branch":
			return ["diff", "--name-only", "HEAD"];
		case "directory":
			return directory
				? ["diff", "HEAD", "--name-only", "--", directory]
				: ["diff", "HEAD", "--name-only"];
		case "all":
			return ["diff", "HEAD", "--name-only"];
	}
}

/**
 * Collect real git diff evidence for the review pipeline.
 * Collects diff evidence matching the requested review scope.
 */
export async function collectDiffEvidence(
	projectRoot: string,
	scope: ReviewScope,
	directory?: string,
): Promise<DiffEvidence> {
	let diff = "";
	let changedFiles: string[] = [];

	try {
		const { stdout } = await execFileAsync("git", getDiffArgs(scope, directory), {
			cwd: projectRoot,
			maxBuffer: 10 * 1024 * 1024,
			timeout: 30_000,
		});
		diff = stdout;

		const { stdout: filesOutput } = await execFileAsync("git", getNameOnlyArgs(scope, directory), {
			cwd: projectRoot,
			maxBuffer: 1024 * 1024,
			timeout: 15_000,
		});
		changedFiles = filesOutput.trim().split("\n").filter(Boolean);
	} catch {
		// Not in a git repo or no commits yet - return empty.
	}

	const truncated = diff.length > MAX_DIFF_SIZE;
	if (truncated) {
		diff = `${diff.slice(0, MAX_DIFF_SIZE)}\n... (diff truncated for review context)`;
	}

	return Object.freeze({
		diff,
		changedFiles: Object.freeze(changedFiles),
		truncated,
	});
}
