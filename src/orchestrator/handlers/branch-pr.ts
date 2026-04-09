import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { BranchLifecycle } from "../types";

const execFileAsync = promisify(execFile);

export interface BranchPrUpdateInput {
	readonly runId: string;
	readonly taskId: string;
	readonly baseBranch?: string;
}

export function computeBranchName(runId: string, description?: string): string {
	const slugCandidate = (description ?? "feature")
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 60);
	const slug = slugCandidate.length > 0 ? slugCandidate : "feature";
	return `autopilot/${runId}/${slug}`;
}

export function initBranchLifecycle(input: {
	readonly runId: string;
	readonly baseBranch?: string;
	readonly description?: string;
}): BranchLifecycle {
	return Object.freeze({
		currentBranch: computeBranchName(input.runId, input.description),
		baseBranch: input.baseBranch ?? "main",
		prNumber: null,
		prUrl: null,
		worktreePath: null,
		createdAt: new Date().toISOString(),
		lastPushedAt: null,
		tasksPushed: [],
	});
}

export function recordTaskPush(lifecycle: BranchLifecycle, taskId: string): BranchLifecycle {
	if (lifecycle.tasksPushed.includes(taskId)) {
		return lifecycle;
	}

	return Object.freeze({
		...lifecycle,
		lastPushedAt: new Date().toISOString(),
		tasksPushed: [...lifecycle.tasksPushed, taskId],
	});
}

export function recordPrCreation(
	lifecycle: BranchLifecycle,
	prNumber: number,
	prUrl: string,
): BranchLifecycle {
	return Object.freeze({
		...lifecycle,
		prNumber,
		prUrl,
	});
}

export function recordWorktreePath(
	lifecycle: BranchLifecycle,
	worktreePath: string,
): BranchLifecycle {
	return Object.freeze({
		...lifecycle,
		worktreePath,
	});
}

export function shouldCreatePr(lifecycle: BranchLifecycle): boolean {
	return lifecycle.prNumber === null && lifecycle.tasksPushed.length > 0;
}

export function shouldUpdatePr(lifecycle: BranchLifecycle): boolean {
	return lifecycle.prNumber !== null;
}

export function formatPrTaskSummary(lifecycle: BranchLifecycle): string {
	if (lifecycle.tasksPushed.length === 0) {
		return "No tasks completed yet.";
	}

	return lifecycle.tasksPushed.map((taskId, index) => `${index + 1}. ✅ ${taskId}`).join("\n");
}

export function buildPrBody(
	lifecycle: BranchLifecycle,
	options: {
		readonly idea: string;
		readonly architectureNotes?: string;
		readonly testSummary?: string;
		readonly remainingTasks?: readonly string[];
	},
): string {
	const lines = [
		"## Summary",
		"",
		options.idea,
		"",
		"## Completed Tasks",
		"",
		formatPrTaskSummary(lifecycle),
		"",
	];

	if (options.architectureNotes) {
		lines.push("## Architecture Decisions", "", options.architectureNotes, "");
	}

	if (options.testSummary) {
		lines.push("## Test Coverage", "", options.testSummary, "");
	}

	if (options.remainingTasks && options.remainingTasks.length > 0) {
		lines.push(
			"## Remaining Tasks",
			"",
			...options.remainingTasks.map((task) => `- [ ] ${task}`),
			"",
		);
	}

	lines.push(
		"---",
		`Branch: \`${lifecycle.currentBranch}\``,
		`Base: \`${lifecycle.baseBranch}\``,
		`Created: ${lifecycle.createdAt ?? "unknown"}`,
		`Last Push: ${lifecycle.lastPushedAt ?? "unknown"}`,
	);

	return lines.join("\n");
}

export interface WorktreeInfo {
	readonly path: string;
	readonly branch: string;
	readonly agentIndex: number;
}

export async function createWorktree(
	projectRoot: string,
	branchName: string,
	agentIndex: number,
	sessionId: string,
): Promise<WorktreeInfo> {
	const worktreeBaseDir = join(tmpdir(), `opencode-${sessionId}`);
	const worktreePath = join(worktreeBaseDir, `wt-${agentIndex}`);

	await mkdir(worktreeBaseDir, { recursive: true });

	try {
		await execFileAsync("git", ["worktree", "add", "-b", branchName, worktreePath, "HEAD"], {
			cwd: projectRoot,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("already exists") || errorMessage.includes("already checked out")) {
			await execFileAsync("git", ["worktree", "remove", worktreePath, "--force"], {
				cwd: projectRoot,
			}).catch(() => {});
			await execFileAsync("git", ["worktree", "add", "-b", branchName, worktreePath, "HEAD"], {
				cwd: projectRoot,
			});
		} else {
			throw error;
		}
	}

	return Object.freeze({
		path: worktreePath,
		branch: branchName,
		agentIndex,
	});
}

export async function removeWorktree(projectRoot: string, worktreePath: string): Promise<void> {
	try {
		await execFileAsync("git", ["worktree", "remove", worktreePath, "--force"], {
			cwd: projectRoot,
		});
	} catch {
		try {
			await rm(worktreePath, { recursive: true, force: true });
		} catch {}
	}
}

export async function cleanupWorktrees(projectRoot: string, sessionId: string): Promise<void> {
	const worktreeBaseDir = join(tmpdir(), `opencode-${sessionId}`);

	try {
		const { stdout } = await execFileAsync("git", ["worktree", "list", "--porcelain"], {
			cwd: projectRoot,
		});

		const worktreePaths = stdout
			.split("\n")
			.filter((line) => line.startsWith("worktree "))
			.map((line) => line.slice("worktree ".length).trim())
			.filter((path) => path.startsWith(worktreeBaseDir));

		for (const path of worktreePaths) {
			await removeWorktree(projectRoot, path);
		}
	} catch {}

	try {
		await rm(worktreeBaseDir, { recursive: true, force: true });
	} catch {}
}

export function getWorktreePath(sessionId: string, agentIndex: number): string {
	return join(tmpdir(), `opencode-${sessionId}/wt-${agentIndex}`);
}
