import { sanitizeTemplateContent } from "../../review/sanitize";
import { getArtifactRef } from "../artifacts";
import { groupByWave } from "../plan";
import { assignWaves } from "../wave-assigner";
import {
	buildPendingResultError,
	buildTaskPrompt,
	findCurrentWave,
	findInProgressTasks,
	findPendingTasks,
	hasCriticalFindings,
	isWaveComplete,
	MAX_STRIKES,
	markTaskDone,
	markTasksInProgress,
} from "./build-utils";
import type { DispatchResult, PhaseHandler, PhaseHandlerContext } from "./types";
import { AGENT_NAMES } from "./types";

export const handleBuild: PhaseHandler = async (
	state,
	artifactDir,
	result?,
	context?: PhaseHandlerContext,
) => {
	const { tasks, buildProgress } = state;
	const resultText = context?.envelope.payload.text ?? result;

	if (tasks.length === 0) {
		return Object.freeze({
			action: "error",
			phase: "BUILD",
			message: "No tasks found",
		} satisfies DispatchResult);
	}

	if (buildProgress.strikeCount > MAX_STRIKES && buildProgress.reviewPending && resultText) {
		return Object.freeze({
			action: "error",
			code: "E_BUILD_MAX_STRIKES",
			phase: "BUILD",
			message: "Max retries exceeded — too many CRITICAL review findings",
		} satisfies DispatchResult);
	}

	let effectiveTasks = tasks;
	const hasDependencies = tasks.some((t) => t.depends_on && t.depends_on.length > 0);
	if (hasDependencies) {
		const waveResult = assignWaves(
			tasks.map((t) => ({ id: t.id, depends_on: t.depends_on ?? [] })),
		);
		if (waveResult.cycles.length > 0) {
			const cycleSet = new Set(waveResult.cycles);
			effectiveTasks = tasks.map((t) => {
				if (cycleSet.has(t.id)) return { ...t, status: "BLOCKED" as const };
				const assigned = waveResult.assignments.get(t.id);
				return assigned !== undefined ? { ...t, wave: assigned } : t;
			});
		} else {
			effectiveTasks = tasks.map((t) => {
				const assigned = waveResult.assignments.get(t.id);
				return assigned !== undefined ? { ...t, wave: assigned } : t;
			});
		}
	}

	const nonDoneTasks = effectiveTasks.filter((t) => t.status !== "DONE" && t.status !== "SKIPPED");
	if (nonDoneTasks.length > 0 && nonDoneTasks.every((t) => t.status === "BLOCKED")) {
		const blockedIds = nonDoneTasks.map((t) => t.id).join(", ");
		return Object.freeze({
			action: "error" as const,
			phase: "BUILD",
			message: `All remaining tasks are BLOCKED due to dependency cycles: [${blockedIds}]`,
			progress: `All remaining tasks are BLOCKED due to dependency cycles: [${blockedIds}]`,
			_stateUpdates: Object.freeze({
				buildProgress: Object.freeze({
					...buildProgress,
				}),
				tasks: effectiveTasks,
			}),
		});
	}

	if (buildProgress.reviewPending && !resultText) {
		return Object.freeze({
			action: "dispatch",
			agent: AGENT_NAMES.REVIEW,
			prompt: "Review completed wave. Scope: branch. Report any CRITICAL findings.",
			phase: "BUILD",
			resultKind: "review_findings",
			progress: "Review pending — dispatching reviewer",
		} satisfies DispatchResult);
	}

	if (buildProgress.reviewPending && resultText) {
		if (hasCriticalFindings(resultText)) {
			const safeResult = sanitizeTemplateContent(resultText).slice(0, 4000);
			const prompt = [
				`CRITICAL review findings detected. Fix the following issues:`,
				safeResult,
				`Reference ${getArtifactRef(artifactDir, "PLAN", "tasks.json")} for context.`,
			].join(" ");

			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.BUILD,
				prompt,
				phase: "BUILD",
				resultKind: "task_completion",
				taskId: buildProgress.currentTask,
				progress: "Fix dispatch — CRITICAL findings",
				_stateUpdates: {
					buildProgress: {
						...buildProgress,
						reviewPending: false,
						strikeCount: buildProgress.strikeCount + 1,
					},
				},
			} satisfies DispatchResult);
		}

		const waveMap = groupByWave(effectiveTasks);
		const nextWave = findCurrentWave(waveMap);

		if (nextWave === null) {
			return Object.freeze({
				action: "complete",
				phase: "BUILD",
				progress: "All tasks and reviews complete",
				_stateUpdates: {
					buildProgress: {
						...buildProgress,
						currentTask: null,
						reviewPending: false,
					},
				},
			} satisfies DispatchResult);
		}

		const pendingTasks = findPendingTasks(waveMap, nextWave);
		const inProgressTasks = findInProgressTasks(waveMap, nextWave);
		const updatedProgress = {
			...buildProgress,
			reviewPending: false,
			currentWave: nextWave,
		};

		if (pendingTasks.length === 0 && inProgressTasks.length > 0) {
			return buildPendingResultError(nextWave, inProgressTasks, updatedProgress);
		}

		if (pendingTasks.length > 0) {
			const task = pendingTasks[0];
			const prompt = await buildTaskPrompt(task, artifactDir);
			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.BUILD,
				prompt,
				phase: "BUILD",
				resultKind: "task_completion",
				taskId: task.id,
				progress: `Wave ${nextWave} — task ${task.id}`,
				_stateUpdates: {
					tasks: [...markTasksInProgress(effectiveTasks, [task.id])],
					buildProgress: { ...updatedProgress, currentTask: task.id },
				},
			} satisfies DispatchResult);
		}

		return Object.freeze({
			action: "error",
			code: "E_BUILD_NO_DISPATCHABLE_TASK",
			phase: "BUILD",
			message: `Wave ${nextWave} has no dispatchable pending tasks.`,
		} satisfies DispatchResult);
	}

	const hasTypedContext = context !== undefined;
	const isTaskCompletion = hasTypedContext && context.envelope.kind === "task_completion";
	const rawTaskId = isTaskCompletion ? context.envelope.taskId : buildProgress.currentTask;
	const taskToComplete =
		typeof rawTaskId === "number"
			? rawTaskId
			: typeof rawTaskId === "string"
				? Number(rawTaskId) || null
				: null;

	if (resultText && !buildProgress.reviewPending && taskToComplete === null) {
		return Object.freeze({
			action: "error",
			code: "E_BUILD_TASK_ID_REQUIRED",
			phase: "BUILD",
			message: "Cannot attribute BUILD result to a task. Provide taskId in result envelope.",
		} satisfies DispatchResult);
	}

	if (resultText && !buildProgress.reviewPending && taskToComplete !== null) {
		if (!effectiveTasks.some((t) => t.id === taskToComplete)) {
			return Object.freeze({
				action: "error",
				code: "E_BUILD_UNKNOWN_TASK",
				phase: "BUILD",
				message: `Unknown taskId in BUILD result: ${taskToComplete}`,
			} satisfies DispatchResult);
		}

		const updatedTasks = markTaskDone(effectiveTasks, taskToComplete);
		const waveMap = groupByWave(updatedTasks);
		const currentWave = buildProgress.currentWave ?? 1;

		if (isWaveComplete(waveMap, currentWave)) {
			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.REVIEW,
				prompt: "Review completed wave. Scope: branch. Report any CRITICAL findings.",
				phase: "BUILD",
				resultKind: "review_findings",
				progress: `Wave ${currentWave} complete — review pending`,
				_stateUpdates: {
					tasks: [...updatedTasks],
					buildProgress: {
						...buildProgress,
						currentTask: taskToComplete,
						reviewPending: true,
					},
				},
			} satisfies DispatchResult);
		}

		const pendingInWave = findPendingTasks(waveMap, currentWave);
		if (pendingInWave.length > 0) {
			const next = pendingInWave[0];
			const prompt = await buildTaskPrompt(next, artifactDir);
			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.BUILD,
				prompt,
				phase: "BUILD",
				resultKind: "task_completion",
				taskId: next.id,
				progress: `Wave ${currentWave} — task ${next.id}`,
				_stateUpdates: {
					tasks: [...markTasksInProgress(updatedTasks, [next.id])],
					buildProgress: {
						...buildProgress,
						currentTask: next.id,
					},
				},
			} satisfies DispatchResult);
		}

		const inProgressInWave = findInProgressTasks(waveMap, currentWave);
		if (inProgressInWave.length > 0) {
			return buildPendingResultError(currentWave, inProgressInWave, buildProgress, updatedTasks);
		}
	}

	const waveMap = groupByWave(effectiveTasks);
	const currentWave = findCurrentWave(waveMap);

	if (currentWave === null) {
		return Object.freeze({
			action: "complete",
			phase: "BUILD",
			progress: "All tasks complete",
		} satisfies DispatchResult);
	}

	const pendingTasks = findPendingTasks(waveMap, currentWave);
	const inProgressTasks = findInProgressTasks(waveMap, currentWave);

	if (pendingTasks.length === 0 && inProgressTasks.length > 0) {
		return buildPendingResultError(currentWave, inProgressTasks, buildProgress);
	}

	if (pendingTasks.length === 0) {
		return Object.freeze({
			action: "complete",
			phase: "BUILD",
			progress: "All tasks complete",
		} satisfies DispatchResult);
	}

	if (pendingTasks.length === 1) {
		const task = pendingTasks[0];
		const prompt = await buildTaskPrompt(task, artifactDir);
		return Object.freeze({
			action: "dispatch",
			agent: AGENT_NAMES.BUILD,
			prompt,
			phase: "BUILD",
			resultKind: "task_completion",
			taskId: task.id,
			progress: `Wave ${currentWave} — task ${task.id}`,
			_stateUpdates: {
				tasks: [...markTasksInProgress(effectiveTasks, [task.id])],
				buildProgress: {
					...buildProgress,
					currentTask: task.id,
					currentWave,
				},
			},
		} satisfies DispatchResult);
	}

	const task = pendingTasks[0];
	const prompt = await buildTaskPrompt(task, artifactDir);
	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.BUILD,
		prompt,
		phase: "BUILD",
		resultKind: "task_completion",
		taskId: task.id,
		progress: `Wave ${currentWave} — task ${task.id}`,
		_stateUpdates: {
			tasks: [...markTasksInProgress(effectiveTasks, [task.id])],
			buildProgress: {
				...buildProgress,
				currentTask: task.id,
				currentWave,
			},
		},
	} satisfies DispatchResult);
};
