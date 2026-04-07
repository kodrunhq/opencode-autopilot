import type { BranchLifecycle } from "../types";

// ADR: Worktrees deferred. Parallel BUILD execution uses dispatch_multi on a
// single branch rather than per-task worktrees. The worktreePath field and
// recordWorktreePath utility are retained for future multi-branch support
// but are not invoked at runtime. See PR #90 for rationale.

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
