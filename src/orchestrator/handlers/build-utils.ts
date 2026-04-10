import { fileExists } from "../../utils/fs-helpers";
import { getArtifactRef } from "../artifacts";
import type { BranchLifecycle, BuildProgress, Task } from "../types";
import { createWorktree, recordWorktreePath } from "./branch-pr";
import type { DispatchResult } from "./types";
import { AGENT_NAMES } from "./types";

/**
 * Coerce a raw taskId (number, string, or null) to a numeric Task.id.
 */
export function coerceTaskId(raw: unknown): number | null {
	if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
	if (typeof raw === "string") {
		const parsed = Number(raw);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export const cloneBranchLifecycle = (bl: BranchLifecycle) => ({
	...bl,
	tasksPushed: [...bl.tasksPushed],
});

export function buildPendingResultWithLifecycle(
	wave: number,
	inProgressTasks: readonly Task[],
	buildProgress: Readonly<BuildProgress>,
	lifecycle: BranchLifecycle,
	updatedTasks?: readonly Task[],
): DispatchResult {
	const pendingResult = buildPendingResultError(wave, inProgressTasks, buildProgress, updatedTasks);
	return Object.freeze({
		...pendingResult,
		_stateUpdates: {
			...pendingResult._stateUpdates,
			branchLifecycle: cloneBranchLifecycle(lifecycle),
		},
	} satisfies DispatchResult);
}

export function mergeDispatchWithLifecycle(
	dispatchResult: DispatchResult,
	lifecycle: BranchLifecycle,
): DispatchResult {
	return Object.freeze({
		...dispatchResult,
		_stateUpdates: {
			...dispatchResult._stateUpdates,
			branchLifecycle: cloneBranchLifecycle(lifecycle),
		},
	} satisfies DispatchResult);
}

const MAX_STRIKES = 3;

const DEFAULT_MAX_PARALLEL_TASKS = 5;

export function findCurrentWave(waveMap: ReadonlyMap<number, readonly Task[]>): number | null {
	const sortedWaves = [...waveMap.keys()].sort((a, b) => a - b);
	for (const wave of sortedWaves) {
		const tasks = waveMap.get(wave) ?? [];
		if (tasks.some((t) => t.status === "PENDING" || t.status === "IN_PROGRESS")) {
			return wave;
		}
	}
	return null;
}

export function findPendingTasks(
	waveMap: ReadonlyMap<number, readonly Task[]>,
	wave: number,
): readonly Task[] {
	const tasks = waveMap.get(wave) ?? [];
	return tasks.filter((t) => t.status === "PENDING");
}

export function findInProgressTasks(
	waveMap: ReadonlyMap<number, readonly Task[]>,
	wave: number,
): readonly Task[] {
	const tasks = waveMap.get(wave) ?? [];
	return tasks.filter((t) => t.status === "IN_PROGRESS");
}

export function buildPendingResultError(
	wave: number,
	inProgressTasks: readonly Task[],
	buildProgress: Readonly<BuildProgress>,
	updatedTasks?: readonly Task[],
): DispatchResult {
	const taskIds = inProgressTasks.map((task) => task.id);
	return Object.freeze({
		action: "error",
		code: "E_BUILD_RESULT_PENDING",
		phase: "BUILD",
		message: `Wave ${wave} still has in-progress task result(s) pending for taskIds [${taskIds.join(", ")}]. Wait for the typed result envelope and pass it back to oc_orchestrate.`,
		progress: `Wave ${wave} — waiting for typed result(s) for taskIds [${taskIds.join(", ")}]`,
		_stateUpdates: {
			...(updatedTasks ? { tasks: [...updatedTasks] } : {}),
			buildProgress: {
				...buildProgress,
				currentWave: wave,
				currentTask: buildProgress.currentTask ?? inProgressTasks[0]?.id ?? null,
				currentTasks: [...taskIds],
			},
		},
	} satisfies DispatchResult);
}

export function markTasksInProgress(
	tasks: readonly Task[],
	taskIds: readonly number[],
): readonly Task[] {
	const idSet = new Set(taskIds);
	return tasks.map((t) => (idSet.has(t.id) ? { ...t, status: "IN_PROGRESS" as const } : t));
}

export async function buildTaskPrompt(
	task: Task,
	artifactDir: string,
	runId?: string,
	mode: "PARALLEL" | "SOLO" = "SOLO",
): Promise<string> {
	const planRef = getArtifactRef(artifactDir, "PLAN", "tasks.json", runId);
	const planFallbackRef = getArtifactRef(artifactDir, "PLAN", "tasks.md", runId);
	const designRef = getArtifactRef(artifactDir, "ARCHITECT", "design.md", runId);
	const planPath = (await fileExists(planRef)) ? planRef : planFallbackRef;
	return [
		`[EXECUTION MODE: ${mode}]`,
		`Implement task ${task.id}: ${task.title}.`,
		`Reference the plan at ${planPath}`,
		`and architecture at ${designRef}.`,
		`If a CLAUDE.md file exists in the project root, read it for project-specific conventions.`,
		`Check ~/.config/opencode/skills/coding-standards/SKILL.md for coding standards.`,
		`Report completion when done.`,
	].join(" ");
}

export function markTaskDone(tasks: readonly Task[], taskId: number): readonly Task[] {
	return tasks.map((t) => (t.id === taskId ? { ...t, status: "DONE" as const } : t));
}

export function markTaskFailed(tasks: readonly Task[], taskId: number): readonly Task[] {
	return tasks.map((t) => (t.id === taskId ? { ...t, status: "FAILED" as const } : t));
}

/**
 * Detect whether a result string is a dispatch failure summary
 * (produced by `buildFailureSummary` when retries are exhausted).
 */
export function isDispatchFailure(resultText: string): boolean {
	return resultText.trimStart().startsWith("DISPATCH_FAILED:");
}

export function isWaveComplete(
	waveMap: ReadonlyMap<number, readonly Task[]>,
	wave: number,
): boolean {
	const tasks = waveMap.get(wave) ?? [];
	return tasks.every((t) => t.status === "DONE" || t.status === "FAILED");
}

export function hasCriticalFindings(resultStr: string): boolean {
	try {
		const parsed = JSON.parse(resultStr);
		if (parsed.severity === "CRITICAL") return true;
		const hasCritical = (arr: unknown[]): boolean =>
			arr.some(
				(f: unknown) =>
					typeof f === "object" &&
					f !== null &&
					"severity" in f &&
					(f as { severity: string }).severity === "CRITICAL",
			);
		if (Array.isArray(parsed.findings)) {
			return hasCritical(parsed.findings);
		}
		if (parsed.report?.findings && Array.isArray(parsed.report.findings)) {
			return hasCritical(parsed.report.findings);
		}
		return false;
	} catch {
		return false;
	}
}

export async function buildParallelDispatch(
	pendingTasks: readonly Task[],
	wave: number,
	effectiveTasks: readonly Task[],
	buildProgress: Readonly<BuildProgress>,
	artifactDir: string,
	runId?: string,
	maxParallel: number = DEFAULT_MAX_PARALLEL_TASKS,
	currentInProgressCount = 0,
	lifecycle?: BranchLifecycle,
	useWorktrees = false,
	projectRoot?: string,
	sessionId?: string,
): Promise<DispatchResult> {
	const remainingSlots = Math.max(0, maxParallel - currentInProgressCount);

	if (remainingSlots === 0) {
		const inProgressTasks = effectiveTasks.filter((t) => t.status === "IN_PROGRESS");
		return buildPendingResultError(wave, inProgressTasks, buildProgress, effectiveTasks);
	}

	const tasksToDispatch = pendingTasks.slice(0, remainingSlots);
	const taskIds = tasksToDispatch.map((t) => t.id);
	const isParallel = currentInProgressCount > 0 || tasksToDispatch.length > 1;
	const mode = isParallel ? ("PARALLEL" as const) : ("SOLO" as const);
	const updatedTaskList = markTasksInProgress(effectiveTasks, taskIds);
	const allInProgressIds = updatedTaskList
		.filter((t) => t.status === "IN_PROGRESS")
		.map((t) => t.id);

	if (tasksToDispatch.length === 1) {
		const task = tasksToDispatch[0];
		const prompt = await buildTaskPrompt(task, artifactDir, runId, mode);
		return Object.freeze({
			action: "dispatch",
			agent: AGENT_NAMES.BUILD,
			prompt,
			phase: "BUILD",
			resultKind: "task_completion",
			taskId: task.id,
			progress: `Wave ${wave} — task ${task.id}`,
			_stateUpdates: {
				tasks: [...updatedTaskList],
				buildProgress: {
					...buildProgress,
					currentTask: task.id,
					currentTasks: [...allInProgressIds],
					currentWave: wave,
				},
			},
		} satisfies DispatchResult);
	}

	if (useWorktrees && projectRoot && sessionId) {
		const branchNameBase = `autopilot/${runId ?? "unknown"}/wave-${wave}`;
		const worktrees = await Promise.all(
			tasksToDispatch.map(async (task, index) => {
				const branchName = `${branchNameBase}/task-${task.id}`;
				const worktreeInfo = await createWorktree(projectRoot, branchName, index, sessionId);
				return { task, worktreeInfo, index };
			}),
		);

		let updatedLifecycle = lifecycle;
		for (const { worktreeInfo } of worktrees) {
			updatedLifecycle = updatedLifecycle
				? recordWorktreePath(updatedLifecycle, worktreeInfo.path)
				: updatedLifecycle;
		}

		const agents = await Promise.all(
			worktrees.map(async ({ task, worktreeInfo }) => {
				const basePrompt = await buildTaskPrompt(task, artifactDir, runId, mode);
				const worktreePath = worktreeInfo.path;
				const worktreePrompt = `${basePrompt}\n\n[WORKTREE: ${worktreePath}]\nYour working directory is ${worktreePath}. All file operations must be relative to this directory.`;
				return {
					agent: AGENT_NAMES.BUILD,
					prompt: worktreePrompt,
					taskId: task.id,
					resultKind: "task_completion" as const,
					workdir: worktreePath,
				};
			}),
		);

		return Object.freeze({
			action: "dispatch_multi",
			agents,
			phase: "BUILD",
			progress: `Wave ${wave} — parallel tasks [${taskIds.join(", ")}] with worktrees`,
			_stateUpdates: {
				tasks: [...updatedTaskList],
				buildProgress: {
					...buildProgress,
					currentTask: taskIds[0],
					currentTasks: [...allInProgressIds],
					currentWave: wave,
				},
				...(updatedLifecycle ? { branchLifecycle: cloneBranchLifecycle(updatedLifecycle) } : {}),
			},
		} satisfies DispatchResult);
	}

	const agents = await Promise.all(
		tasksToDispatch.map(async (task) => ({
			agent: AGENT_NAMES.BUILD,
			prompt: await buildTaskPrompt(task, artifactDir, runId, mode),
			taskId: task.id,
			resultKind: "task_completion" as const,
		})),
	);

	return Object.freeze({
		action: "dispatch_multi",
		agents,
		phase: "BUILD",
		progress: `Wave ${wave} — parallel tasks [${taskIds.join(", ")}]`,
		_stateUpdates: {
			tasks: [...updatedTaskList],
			buildProgress: {
				...buildProgress,
				currentTask: taskIds[0],
				currentTasks: [...allInProgressIds],
				currentWave: wave,
			},
		},
	} satisfies DispatchResult);
}

export { DEFAULT_MAX_PARALLEL_TASKS, MAX_STRIKES };
