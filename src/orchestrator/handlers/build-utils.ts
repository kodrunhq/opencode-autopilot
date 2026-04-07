import { fileExists } from "../../utils/fs-helpers";
import { getArtifactRef } from "../artifacts";
import type { BuildProgress, Task } from "../types";
import type { DispatchResult } from "./types";
import { AGENT_NAMES } from "./types";

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
): Promise<string> {
	const planRef = getArtifactRef(artifactDir, "PLAN", "tasks.json", runId);
	const planFallbackRef = getArtifactRef(artifactDir, "PLAN", "tasks.md", runId);
	const designRef = getArtifactRef(artifactDir, "ARCHITECT", "design.md", runId);
	const planPath = (await fileExists(planRef)) ? planRef : planFallbackRef;
	return [
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
): Promise<DispatchResult> {
	const remainingSlots = Math.max(0, maxParallel - currentInProgressCount);

	if (remainingSlots === 0) {
		// Cap is full — return pending result so caller waits for in-progress tasks to finish.
		const inProgressTasks = effectiveTasks.filter((t) => t.status === "IN_PROGRESS");
		return buildPendingResultError(wave, inProgressTasks, buildProgress, effectiveTasks);
	}

	const tasksToDispatch = pendingTasks.slice(0, remainingSlots);
	const taskIds = tasksToDispatch.map((t) => t.id);

	if (tasksToDispatch.length === 1) {
		const task = tasksToDispatch[0];
		const prompt = await buildTaskPrompt(task, artifactDir, runId);
		return Object.freeze({
			action: "dispatch",
			agent: AGENT_NAMES.BUILD,
			prompt,
			phase: "BUILD",
			resultKind: "task_completion",
			taskId: task.id,
			progress: `Wave ${wave} — task ${task.id}`,
			_stateUpdates: {
				tasks: [...markTasksInProgress(effectiveTasks, [task.id])],
				buildProgress: {
					...buildProgress,
					currentTask: task.id,
					currentTasks: [task.id],
					currentWave: wave,
				},
			},
		} satisfies DispatchResult);
	}

	const agents = await Promise.all(
		tasksToDispatch.map(async (task) => ({
			agent: AGENT_NAMES.BUILD,
			prompt: await buildTaskPrompt(task, artifactDir, runId),
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
			tasks: [...markTasksInProgress(effectiveTasks, taskIds)],
			buildProgress: {
				...buildProgress,
				currentTask: taskIds[0],
				currentTasks: [...taskIds],
				currentWave: wave,
			},
		},
	} satisfies DispatchResult);
}

export { DEFAULT_MAX_PARALLEL_TASKS, MAX_STRIKES };
