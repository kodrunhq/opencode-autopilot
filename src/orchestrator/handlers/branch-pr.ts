import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
	computeManifestBranchName,
	type DeliveryManifest,
	deriveProgramId,
	deriveTrancheId,
	renderDeliveryPrBody,
	toHumanTitle,
} from "../delivery-manifest";
import type { BranchLifecycle } from "../types";

const execFileAsync = promisify(execFile);

export interface BranchPrUpdateInput {
	readonly runId: string;
	readonly taskId: string;
	readonly baseBranch?: string;
}

export function computeBranchName(
	programId: string,
	trancheId: string,
	humanTitle: string,
): string {
	return computeManifestBranchName(programId, trancheId, humanTitle);
}

export function initBranchLifecycle(input: {
	readonly runId: string;
	readonly baseBranch?: string;
	readonly description?: string;
	readonly commitStrategy?: BranchLifecycle["commitStrategy"];
	readonly programId?: string | null;
	readonly trancheId?: string | null;
	readonly humanTitle?: string | null;
}): BranchLifecycle {
	const humanTitle = toHumanTitle(input.humanTitle ?? input.description);
	const programId = input.programId ?? deriveProgramId(input.runId, humanTitle);
	const trancheId = input.trancheId ?? deriveTrancheId(input.runId);
	return Object.freeze({
		currentBranch: computeBranchName(programId, trancheId, humanTitle),
		baseBranch: input.baseBranch ?? "main",
		prNumber: null,
		prUrl: null,
		worktreePath: null,
		createdAt: new Date().toISOString(),
		lastPushedAt: null,
		tasksPushed: [],
		programId,
		trancheId,
		humanTitle,
		commitStrategy: input.commitStrategy ?? "per_task",
		reviewSummary: null,
		oracleSummary: null,
		verificationSummary: null,
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

export function buildPrBody(manifest: DeliveryManifest): string {
	return renderDeliveryPrBody(manifest);
}

export function recordReviewSummary(
	lifecycle: BranchLifecycle,
	reviewSummary: string,
): BranchLifecycle {
	return Object.freeze({
		...lifecycle,
		reviewSummary,
	});
}

export function recordOracleSummary(
	lifecycle: BranchLifecycle,
	oracleSummary: string,
): BranchLifecycle {
	return Object.freeze({
		...lifecycle,
		oracleSummary,
	});
}

export function recordVerificationSummary(
	lifecycle: BranchLifecycle,
	verificationSummary: string,
): BranchLifecycle {
	return Object.freeze({
		...lifecycle,
		verificationSummary,
	});
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
