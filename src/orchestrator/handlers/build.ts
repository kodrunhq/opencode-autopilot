import { loadConfig } from "../../config";
import { sanitizeTemplateContent } from "../../review/sanitize";
import { getProjectRootFromArtifactDir } from "../../utils/paths";
import { getArtifactRef } from "../artifacts";
import { createOracleGateIntegration, defaultOracleGate } from "../oracle-gate";
import { groupByWave } from "../plan";
import { assignWaves } from "../wave-assigner";
import { cleanupWorktrees, initBranchLifecycle, recordTaskPush } from "./branch-pr";
import {
	buildParallelDispatch,
	buildPendingResultError,
	buildPendingResultWithLifecycle,
	cloneBranchLifecycle,
	coerceTaskId,
	DEFAULT_MAX_PARALLEL_TASKS,
	findCurrentWave,
	findInProgressTasks,
	findPendingTasks,
	hasCriticalFindings,
	isDispatchFailure,
	isWaveComplete,
	MAX_STRIKES,
	markTaskDone,
	markTaskFailed,
	mergeDispatchWithLifecycle,
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
	const config = await loadConfig();
	const maxParallel = config?.orchestrator?.maxParallelTasks ?? DEFAULT_MAX_PARALLEL_TASKS;
	const useWorktrees = state.useWorktrees ?? false;
	const projectRoot = getProjectRootFromArtifactDir(artifactDir);
	const initialBranchLifecycle =
		state.branchLifecycle ??
		initBranchLifecycle({
			runId: state.runId,
			baseBranch: "main",
			description: state.idea.slice(0, 60),
		});
	const branchLifecycleUpdates =
		state.branchLifecycle === null
			? Object.freeze({ branchLifecycle: cloneBranchLifecycle(initialBranchLifecycle) })
			: undefined;
	if (tasks.length === 0) {
		return Object.freeze({
			action: "error",
			phase: "BUILD",
			message: "No tasks found",
		} satisfies DispatchResult);
	}

	if (buildProgress.strikeCount > MAX_STRIKES) {
		return Object.freeze({
			action: "error",
			code: "E_BUILD_MAX_STRIKES",
			phase: "BUILD",
			message: `Max retries exceeded (${buildProgress.strikeCount} > ${MAX_STRIKES}) — too many CRITICAL review findings`,
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
			// Check if Oracle consultation is needed for this task
			const oracleGate = createOracleGateIntegration(defaultOracleGate);
			const taskToCheck = effectiveTasks.find((t) => t.id === buildProgress.currentTask);

			if (taskToCheck) {
				const { needsConsultation, prompt: oraclePrompt } = oracleGate.checkTaskForOracle(
					taskToCheck,
					{
						attemptCount: 0,
						strikeCount: buildProgress.strikeCount,
						reviewFindings: [resultText],
						artifactDir,
						runId: state.runId,
					},
				);

				if (needsConsultation && oraclePrompt) {
					// Dispatch to Oracle instead of BUILD
					return Object.freeze({
						action: "dispatch",
						agent: "oracle",
						prompt: oraclePrompt,
						phase: "BUILD",
						resultKind: "oracle_consultation",
						taskId: buildProgress.currentTask,
						progress: "Oracle consultation — CRITICAL findings detected",
						_stateUpdates: {
							buildProgress: {
								...buildProgress,
								reviewPending: false,
								oraclePending: true,
							},
						},
					} satisfies DispatchResult);
				}
			}

			// No Oracle consultation needed or no task found, proceed with BUILD fix
			const safeResult = sanitizeTemplateContent(resultText).slice(0, 4000);
			const prompt = [
				`CRITICAL review findings detected. Fix the following issues:`,
				safeResult,
				`Reference ${getArtifactRef(artifactDir, "PLAN", "tasks.json", state.runId)} for context.`,
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
			if (useWorktrees) {
				await cleanupWorktrees(projectRoot, state.runId);
			}
			return Object.freeze({
				action: "complete",
				phase: "BUILD",
				progress: "All tasks and reviews complete",
				_stateUpdates: {
					branchLifecycle: cloneBranchLifecycle(initialBranchLifecycle),
					buildProgress: {
						...buildProgress,
						currentTask: null,
						currentTasks: [],
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
			return buildParallelDispatch(
				pendingTasks,
				nextWave,
				effectiveTasks,
				updatedProgress,
				artifactDir,
				state.runId,
				maxParallel,
				inProgressTasks.length,
				useWorktrees,
				projectRoot,
				state.runId,
			);
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
	const isOracleConsultation = hasTypedContext && context.envelope.kind === "oracle_consultation";
	const rawTaskId =
		isTaskCompletion || isOracleConsultation ? context.envelope.taskId : buildProgress.currentTask;
	const taskToComplete = coerceTaskId(rawTaskId);

	// Handle Oracle consultation result
	if (
		resultText &&
		buildProgress.oraclePending &&
		isOracleConsultation &&
		taskToComplete !== null
	) {
		const oracleGate = createOracleGateIntegration(defaultOracleGate);
		const {
			success,
			result: oracleResult,
			error,
		} = oracleGate.applyOracleRecommendation(taskToComplete, resultText);

		if (!success) {
			return Object.freeze({
				action: "error",
				code: "E_ORACLE_PARSE_FAILED",
				phase: "BUILD",
				message: `Failed to parse Oracle recommendation: ${error}`,
				progress: "Oracle consultation failed",
				_stateUpdates: {
					buildProgress: {
						...buildProgress,
						oraclePending: false,
					},
				},
			} satisfies DispatchResult);
		}

		if (!oracleResult) {
			return Object.freeze({
				action: "error",
				code: "E_ORACLE_NO_RESULT",
				phase: "BUILD",
				message: "Oracle returned no actionable recommendation",
				progress: "Oracle consultation inconclusive",
				_stateUpdates: {
					buildProgress: {
						...buildProgress,
						oraclePending: false,
					},
				},
			} satisfies DispatchResult);
		}

		// Check if Oracle recommends blocking progression
		if (
			oracleResult.recommendedAction.toLowerCase().includes("block") ||
			oracleResult.recommendedAction.toLowerCase().includes("stop")
		) {
			return Object.freeze({
				action: "error",
				code: "E_ORACLE_BLOCKED",
				phase: "BUILD",
				message: `Oracle blocks progression: ${oracleResult.recommendedAction}`,
				progress: "Oracle blocked progression — CRITICAL issues",
				_stateUpdates: {
					buildProgress: {
						...buildProgress,
						oraclePending: false,
						strikeCount: buildProgress.strikeCount + 1,
					},
				},
			} satisfies DispatchResult);
		}

		// Oracle allows progression, dispatch to BUILD with fix prompt
		const safeResult = sanitizeTemplateContent(resultText).slice(0, 4000);
		const prompt = [
			`Oracle consultation completed. Recommendation: ${oracleResult.recommendedAction}`,
			`Reasoning: ${oracleResult.reasoning}`,
			`Fix the following issues:`,
			safeResult,
			`Reference ${getArtifactRef(artifactDir, "PLAN", "tasks.json", state.runId)} for context.`,
		].join(" ");

		return Object.freeze({
			action: "dispatch",
			agent: AGENT_NAMES.BUILD,
			prompt,
			phase: "BUILD",
			resultKind: "task_completion",
			taskId: taskToComplete,
			progress: "Fix dispatch — Oracle approved",
			_stateUpdates: {
				buildProgress: {
					...buildProgress,
					oraclePending: false,
					strikeCount: buildProgress.strikeCount + 1,
				},
			},
		} satisfies DispatchResult);
	}

	if (resultText && !buildProgress.reviewPending && taskToComplete === null) {
		return Object.freeze({
			action: "error",
			code: "E_BUILD_TASK_ID_REQUIRED",
			phase: "BUILD",
			message: "Cannot attribute BUILD result to a task. Provide taskId in result envelope.",
		} satisfies DispatchResult);
	}

	if (
		resultText &&
		!buildProgress.reviewPending &&
		!buildProgress.oraclePending &&
		taskToComplete !== null
	) {
		if (!effectiveTasks.some((t) => t.id === taskToComplete)) {
			return Object.freeze({
				action: "error",
				code: "E_BUILD_UNKNOWN_TASK",
				phase: "BUILD",
				message: `Unknown taskId in BUILD result: ${taskToComplete}`,
			} satisfies DispatchResult);
		}

		const taskFailed = isDispatchFailure(resultText);
		const updatedTasks = taskFailed
			? markTaskFailed(effectiveTasks, taskToComplete)
			: markTaskDone(effectiveTasks, taskToComplete);
		const updatedBranchLifecycle = taskFailed
			? initialBranchLifecycle
			: recordTaskPush(initialBranchLifecycle, taskToComplete.toString());
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
					branchLifecycle: cloneBranchLifecycle(updatedBranchLifecycle),
					buildProgress: {
						...buildProgress,
						currentTask: taskToComplete,
						currentTasks: [],
						reviewPending: true,
					},
				},
			} satisfies DispatchResult);
		}

		const pendingInWave = findPendingTasks(waveMap, currentWave);
		const inProgressInWave = findInProgressTasks(waveMap, currentWave);
		if (pendingInWave.length > 0) {
			const updatedProgressForDispatch = {
				...buildProgress,
				currentWave,
			};
			const dispatchResult = await buildParallelDispatch(
				pendingInWave,
				currentWave,
				updatedTasks,
				updatedProgressForDispatch,
				artifactDir,
				state.runId,
				maxParallel,
				inProgressInWave.length,
			);
			return mergeDispatchWithLifecycle(dispatchResult, updatedBranchLifecycle);
		}

		if (inProgressInWave.length > 0) {
			return buildPendingResultWithLifecycle(
				currentWave,
				inProgressInWave,
				buildProgress,
				updatedBranchLifecycle,
				updatedTasks,
			);
		}
	}

	const waveMap = groupByWave(effectiveTasks);
	const currentWave = findCurrentWave(waveMap);

	if (currentWave === null) {
		if (useWorktrees) {
			await cleanupWorktrees(projectRoot, state.runId);
		}
		return Object.freeze({
			action: "complete",
			phase: "BUILD",
			progress: "All tasks complete",
			_stateUpdates: {
				branchLifecycle: cloneBranchLifecycle(initialBranchLifecycle),
			},
		} satisfies DispatchResult);
	}

	const pendingTasks = findPendingTasks(waveMap, currentWave);
	const inProgressTasks = findInProgressTasks(waveMap, currentWave);

	if (pendingTasks.length === 0 && inProgressTasks.length > 0) {
		return buildPendingResultWithLifecycle(
			currentWave,
			inProgressTasks,
			buildProgress,
			initialBranchLifecycle,
		);
	}

	if (pendingTasks.length === 0) {
		if (useWorktrees) {
			await cleanupWorktrees(projectRoot, state.runId);
		}
		return Object.freeze({
			action: "complete",
			phase: "BUILD",
			progress: "All tasks complete",
			_stateUpdates: {
				branchLifecycle: cloneBranchLifecycle(initialBranchLifecycle),
			},
		} satisfies DispatchResult);
	}

	const initialDispatch = await buildParallelDispatch(
		pendingTasks,
		currentWave,
		effectiveTasks,
		buildProgress,
		artifactDir,
		state.runId,
		maxParallel,
		inProgressTasks.length,
		useWorktrees,
		projectRoot,
		state.runId,
	);
	return Object.freeze({
		...initialDispatch,
		_stateUpdates: {
			...(branchLifecycleUpdates ?? {}),
			...initialDispatch._stateUpdates,
		},
	} satisfies DispatchResult);
};
