import { loadConfig } from "../../config";
import { sanitizeTemplateContent } from "../../review/sanitize";
import { getProjectRootFromArtifactDir } from "../../utils/paths";
import { getArtifactRef } from "../artifacts";
import { summarizeOracleOutcome, summarizeReviewOutcome } from "../delivery-manifest";
import { createOracleGateIntegration, defaultOracleGate } from "../oracle-gate";
import { groupByWave } from "../plan";
import {
	buildReviewDispatchPrompt,
	buildReviewFixPrompt,
	buildReviewGateMessage,
	parseReviewCoordinatorResult,
	planReviewRun,
	reviewStatusSchema,
	summarizeReviewRun,
} from "../review-runner";
import { persistTrancheOracleSignoff, type TrancheOracleSignoff } from "../signoff";
import type { Task } from "../types";
import { assignWaves } from "../wave-assigner";
import {
	cleanupWorktrees,
	initBranchLifecycle,
	recordOracleSummary,
	recordReviewSummary,
	recordTaskPush,
} from "./branch-pr";
import {
	buildParallelDispatch,
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

function summarizeVerificationResults(reviewReport: string | null): string {
	return reviewReport
		? "Wave review completed without CRITICAL findings. No separate local verification artifact is recorded during BUILD."
		: "No structured review report has been recorded for this tranche.";
}

function getRemainingBacklog(tasks: readonly Task[]): readonly string[] {
	return tasks
		.filter((task) => task.status !== "DONE" && task.status !== "SKIPPED")
		.map((task) => `Task ${task.id}: ${task.title} [${task.status}]`);
}

function createBuildCompleteResult(
	buildProgress: Readonly<BuildProgressLike>,
	branchLifecycle: ReturnType<typeof cloneBranchLifecycle>,
	progress: string,
): DispatchResult {
	return Object.freeze({
		action: "complete",
		phase: "BUILD",
		progress,
		_stateUpdates: {
			branchLifecycle,
			buildProgress: {
				...buildProgress,
				currentTasks: [],
				currentTask: null,
				reviewPending: false,
				oraclePending: false,
				oracleSignoffId: null,
				oracleInputsDigest: null,
			},
		},
	} satisfies DispatchResult);
}

type BuildProgressLike = Readonly<{
	currentTask: number | null;
	currentTasks: readonly number[];
	currentWave: number | null;
	attemptCount: number;
	strikeCount: number;
	reviewPending: boolean;
	oraclePending: boolean;
	oracleSignoffId: string | null;
	oracleInputsDigest: string | null;
	lastReviewReport: string | null;
}>;

function buildTrancheOracleGateRequest(
	state: Parameters<PhaseHandler>[0],
	tasks: readonly Task[],
	buildProgress: BuildProgressLike,
) {
	const oracleGate = createOracleGateIntegration(defaultOracleGate);
	return oracleGate.createTrancheSignoffRequest({
		originalIntent: state.idea,
		tasks,
		reviewReport: buildProgress.lastReviewReport ?? "No review report recorded.",
		verificationResults: summarizeVerificationResults(buildProgress.lastReviewReport),
		remainingBacklog: getRemainingBacklog(tasks),
		taskPushes: state.branchLifecycle?.tasksPushed ?? [],
	});
}

function createTrancheOracleSignoffDispatch(
	state: Parameters<PhaseHandler>[0],
	tasks: readonly Task[],
	buildProgress: BuildProgressLike,
	branchLifecycle: ReturnType<typeof cloneBranchLifecycle>,
): DispatchResult {
	const request = buildTrancheOracleGateRequest(state, tasks, buildProgress);
	return Object.freeze({
		action: "dispatch",
		agent: "oracle",
		prompt: request.prompt,
		phase: "BUILD",
		resultKind: "oracle_signoff",
		progress: "Oracle tranche signoff pending",
		_stateUpdates: {
			branchLifecycle,
			buildProgress: {
				...buildProgress,
				currentTasks: [...buildProgress.currentTasks],
				oraclePending: true,
				oracleSignoffId: request.signoffId,
				oracleInputsDigest: request.inputsDigest,
			},
		},
	} satisfies DispatchResult);
}

function resolveBuildCompletionGate(
	state: Parameters<PhaseHandler>[0],
	tasks: readonly Task[],
	buildProgress: BuildProgressLike,
	branchLifecycle: ReturnType<typeof cloneBranchLifecycle>,
): DispatchResult {
	const request = buildTrancheOracleGateRequest(state, tasks, buildProgress);
	const trancheSignoff = state.oracleSignoffs.tranche;
	if (trancheSignoff && trancheSignoff.inputsDigest === request.inputsDigest) {
		if (createOracleGateIntegration(defaultOracleGate).isPassingTrancheSignoff(trancheSignoff)) {
			return createBuildCompleteResult(
				buildProgress,
				branchLifecycle,
				"All tasks, reviews, and Oracle tranche signoff complete",
			);
		}

		const blockingConditions = trancheSignoff.blockingConditions.join("; ");
		return Object.freeze({
			action: "error",
			code: "E_ORACLE_TRANCHE_SIGNOFF_FAILED",
			phase: "BUILD",
			message: blockingConditions
				? `Oracle tranche signoff failed: ${blockingConditions}`
				: `Oracle tranche signoff failed: ${trancheSignoff.reasoning}`,
			progress: "Oracle tranche signoff blocked shipping",
			_stateUpdates: {
				branchLifecycle,
				buildProgress: {
					...buildProgress,
					currentTasks: [...buildProgress.currentTasks],
					oraclePending: false,
					oracleSignoffId: null,
					oracleInputsDigest: null,
				},
			},
		} satisfies DispatchResult);
	}

	return createTrancheOracleSignoffDispatch(state, tasks, buildProgress, branchLifecycle);
}

async function planBuildReviewRun(state: Parameters<PhaseHandler>[0], projectRoot: string) {
	const existingReviewStatus = state.reviewStatus.status !== "IDLE" ? state.reviewStatus : null;
	const reuseExistingPlan =
		existingReviewStatus !== null &&
		state.buildProgress.reviewPending &&
		(existingReviewStatus.status === "RUNNING" || existingReviewStatus.status === "PLANNED");
	return planReviewRun(projectRoot, {
		scope: "branch",
		runId: state.runId,
		trancheId: state.branchLifecycle?.trancheId ?? state.runId,
		reviewRunId: reuseExistingPlan ? (existingReviewStatus?.reviewRunId ?? undefined) : undefined,
		selectedReviewers:
			existingReviewStatus && existingReviewStatus.selectedReviewers.length > 0
				? existingReviewStatus.selectedReviewers
				: undefined,
		requiredReviewers:
			existingReviewStatus && existingReviewStatus.requiredReviewers.length > 0
				? existingReviewStatus.requiredReviewers
				: undefined,
		blockingSeverityThreshold: existingReviewStatus?.blockingSeverityThreshold,
	});
}

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
			description: state.idea,
			programId: state.programContext?.programId,
			trancheId: state.programContext?.trancheId,
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
			message: `Max retries exceeded (${buildProgress.strikeCount} > ${MAX_STRIKES}) — too many blocking review findings`,
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
		const reviewPlan = await planBuildReviewRun(state, projectRoot);
		return Object.freeze({
			action: "dispatch",
			agent: AGENT_NAMES.REVIEW,
			prompt: buildReviewDispatchPrompt(reviewPlan),
			phase: "BUILD",
			resultKind: "review_findings",
			progress: "Review pending — dispatching reviewer",
			_stateUpdates: {
				reviewStatus: summarizeReviewRun(reviewPlan.reviewRun),
			},
		} satisfies DispatchResult);
	}

	if (buildProgress.reviewPending && resultText) {
		const structuredReview = parseReviewCoordinatorResult(resultText);
		const structuredReviewStatus =
			structuredReview?.action === "complete" && structuredReview.reviewStatus
				? structuredReview.reviewStatus
				: structuredReview?.action === "complete" && structuredReview.reviewRun
					? summarizeReviewRun(structuredReview.reviewRun)
					: null;
		const legacyReviewSummary = summarizeReviewOutcome(resultText);
		const legacyReviewBlocked =
			legacyReviewSummary.verdict === "BLOCKED" || hasCriticalFindings(resultText);
		const legacyReviewStatus =
			structuredReviewStatus === null
				? reviewStatusSchema.parse({
						...state.reviewStatus,
						status: legacyReviewBlocked ? "BLOCKED" : "PASSED",
						verdict: legacyReviewBlocked
							? "BLOCKED"
							: legacyReviewSummary.verdict === "CONCERNS"
								? "CONCERNS"
								: legacyReviewSummary.verdict === "CLEAN"
									? "CLEAN"
									: "APPROVED",
						summary: legacyReviewSummary.summary,
						blockedReason: legacyReviewBlocked ? legacyReviewSummary.summary : null,
						completedAt: new Date().toISOString(),
					})
				: null;
		const effectiveReviewStatus = structuredReviewStatus ?? legacyReviewStatus;
		if (structuredReview && structuredReview.action !== "complete") {
			return Object.freeze({
				action: "error",
				code: "E_BUILD_REVIEW_INCOMPLETE",
				phase: "BUILD",
				message:
					structuredReview.message ??
					`Review stage returned ${structuredReview.action} instead of complete.`,
				progress: "Review stage did not complete",
			} satisfies DispatchResult);
		}
		const reviewSummaryText = effectiveReviewStatus?.summary ?? legacyReviewSummary.summary;
		const reviewedBranchLifecycle = recordReviewSummary(initialBranchLifecycle, reviewSummaryText);
		const safeReviewReport = sanitizeTemplateContent(resultText).slice(0, 4000);

		if (
			structuredReview?.action === "complete" &&
			structuredReview.reviewRun &&
			structuredReviewStatus
		) {
			const gateMessage = buildReviewGateMessage(structuredReviewStatus);
			if (gateMessage) {
				const prompt = buildReviewFixPrompt(
					structuredReview.reviewRun,
					getArtifactRef(artifactDir, "PLAN", "tasks.json", state.runId),
				);

				return Object.freeze({
					action: "dispatch",
					agent: AGENT_NAMES.BUILD,
					prompt,
					phase: "BUILD",
					resultKind: "task_completion",
					taskId: buildProgress.currentTask,
					progress: "Fix dispatch — review stage blocked",
					_stateUpdates: {
						branchLifecycle: cloneBranchLifecycle(reviewedBranchLifecycle),
						reviewStatus: structuredReviewStatus,
						buildProgress: {
							...buildProgress,
							reviewPending: false,
							oraclePending: false,
							oracleSignoffId: null,
							oracleInputsDigest: null,
							strikeCount: buildProgress.strikeCount + 1,
							lastReviewReport: safeReviewReport,
						},
					},
				} satisfies DispatchResult);
			}
		}

		if (hasCriticalFindings(resultText)) {
			const prompt = [
				`CRITICAL review findings detected. Fix the following issues:`,
				safeReviewReport,
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
					branchLifecycle: cloneBranchLifecycle(reviewedBranchLifecycle),
					...(effectiveReviewStatus ? { reviewStatus: effectiveReviewStatus } : {}),
					buildProgress: {
						...buildProgress,
						reviewPending: false,
						oraclePending: false,
						oracleSignoffId: null,
						oracleInputsDigest: null,
						strikeCount: buildProgress.strikeCount + 1,
						lastReviewReport: safeReviewReport,
					},
				},
			} satisfies DispatchResult);
		}

		const waveMap = groupByWave(effectiveTasks);
		const nextWave = findCurrentWave(waveMap);
		const completedReviewProgress = {
			...buildProgress,
			reviewPending: false,
			oraclePending: false,
			oracleSignoffId: null,
			oracleInputsDigest: null,
			lastReviewReport: safeReviewReport,
		};
		const reviewStateUpdates = effectiveReviewStatus ? { reviewStatus: effectiveReviewStatus } : {};

		if (nextWave === null) {
			const gateResult = resolveBuildCompletionGate(
				state,
				effectiveTasks,
				completedReviewProgress,
				cloneBranchLifecycle(reviewedBranchLifecycle),
			);
			if (gateResult.action === "complete" && useWorktrees) {
				await cleanupWorktrees(projectRoot, state.runId);
			}
			return Object.freeze({
				...gateResult,
				_stateUpdates: {
					...gateResult._stateUpdates,
					...reviewStateUpdates,
				},
			} satisfies DispatchResult);
		}

		const pendingTasks = findPendingTasks(waveMap, nextWave);
		const inProgressTasks = findInProgressTasks(waveMap, nextWave);
		const updatedProgress = {
			...completedReviewProgress,
			currentWave: nextWave,
		};

		if (pendingTasks.length === 0 && inProgressTasks.length > 0) {
			const pendingResult = buildPendingResultWithLifecycle(
				nextWave,
				inProgressTasks,
				updatedProgress,
				reviewedBranchLifecycle,
			);
			return Object.freeze({
				...pendingResult,
				_stateUpdates: {
					...pendingResult._stateUpdates,
					...reviewStateUpdates,
				},
			} satisfies DispatchResult);
		}

		if (pendingTasks.length > 0) {
			const dispatchResult = await buildParallelDispatch(
				pendingTasks,
				nextWave,
				effectiveTasks,
				updatedProgress,
				artifactDir,
				state.runId,
				maxParallel,
				inProgressTasks.length,
				reviewedBranchLifecycle,
				useWorktrees,
				projectRoot,
				state.runId,
			);
			const mergedDispatch = mergeDispatchWithLifecycle(dispatchResult, reviewedBranchLifecycle);
			return Object.freeze({
				...mergedDispatch,
				_stateUpdates: {
					...mergedDispatch._stateUpdates,
					...reviewStateUpdates,
				},
			} satisfies DispatchResult);
		}

		return Object.freeze({
			action: "error",
			code: "E_BUILD_NO_DISPATCHABLE_TASK",
			phase: "BUILD",
			message: `Wave ${nextWave} has no dispatchable pending tasks.`,
			_stateUpdates: {
				branchLifecycle: cloneBranchLifecycle(reviewedBranchLifecycle),
				...reviewStateUpdates,
			},
		} satisfies DispatchResult);
	}

	const hasTypedContext = context !== undefined;
	const isTaskCompletion = hasTypedContext && context.envelope.kind === "task_completion";
	const isOracleSignoff = hasTypedContext && context.envelope.kind === "oracle_signoff";
	const rawTaskId = isTaskCompletion ? context.envelope.taskId : buildProgress.currentTask;
	const taskToComplete = coerceTaskId(rawTaskId);

	if (resultText && buildProgress.oraclePending && isOracleSignoff) {
		const signoffId = buildProgress.oracleSignoffId;
		const inputsDigest = buildProgress.oracleInputsDigest;
		if (!signoffId || !inputsDigest) {
			return Object.freeze({
				action: "error",
				code: "E_ORACLE_SIGNOFF_CONTEXT_MISSING",
				phase: "BUILD",
				message: "Oracle signoff response arrived without pending signoff metadata.",
			} satisfies DispatchResult);
		}

		const oracleGate = createOracleGateIntegration(defaultOracleGate);
		let signoff: TrancheOracleSignoff;
		try {
			signoff = oracleGate.parseTrancheSignoff(resultText, {
				signoffId,
				inputsDigest,
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return Object.freeze({
				action: "error",
				code: "E_ORACLE_PARSE_FAILED",
				phase: "BUILD",
				message: `Oracle tranche signoff parse failed: ${message}`,
				progress: "Oracle tranche signoff failed",
				_stateUpdates: {
					buildProgress: {
						...buildProgress,
						oraclePending: false,
						oracleSignoffId: null,
						oracleInputsDigest: null,
					},
				},
			} satisfies DispatchResult);
		}

		await persistTrancheOracleSignoff(artifactDir, signoff, state.runId);
		const oracleSummaryLifecycle = recordOracleSummary(
			initialBranchLifecycle,
			summarizeOracleOutcome({
				recommendedAction: `Tranche Oracle ${signoff.verdict}`,
				reasoning: [signoff.reasoning, ...signoff.blockingConditions].join(" ").trim(),
			}).summary,
		);
		const nextBuildProgress = {
			...buildProgress,
			oraclePending: false,
			oracleSignoffId: null,
			oracleInputsDigest: null,
		};
		const nextStateUpdates = {
			oracleSignoffs: {
				...state.oracleSignoffs,
				tranche: signoff,
			},
			buildProgress: nextBuildProgress,
			branchLifecycle: cloneBranchLifecycle(oracleSummaryLifecycle),
		};

		if (oracleGate.isPassingTrancheSignoff(signoff)) {
			if (useWorktrees) {
				await cleanupWorktrees(projectRoot, state.runId);
			}
			return Object.freeze({
				...createBuildCompleteResult(
					nextBuildProgress,
					cloneBranchLifecycle(oracleSummaryLifecycle),
					"Oracle tranche signoff passed — BUILD complete",
				),
				_stateUpdates: {
					...nextStateUpdates,
					buildProgress: {
						...nextBuildProgress,
						currentTask: null,
						currentTasks: [],
					},
				},
			} satisfies DispatchResult);
		}

		const blockingConditions = signoff.blockingConditions.join("; ");
		return Object.freeze({
			action: "error",
			code: "E_ORACLE_TRANCHE_SIGNOFF_FAILED",
			phase: "BUILD",
			message: blockingConditions
				? `Oracle tranche signoff failed: ${blockingConditions}`
				: `Oracle tranche signoff failed: ${signoff.reasoning}`,
			progress: "Oracle tranche signoff blocked shipping",
			_stateUpdates: nextStateUpdates,
		} satisfies DispatchResult);
	}

	if (
		resultText &&
		!buildProgress.reviewPending &&
		!buildProgress.oraclePending &&
		taskToComplete === null
	) {
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
			const reviewPlan = await planBuildReviewRun(state, projectRoot);
			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.REVIEW,
				prompt: buildReviewDispatchPrompt(reviewPlan),
				phase: "BUILD",
				resultKind: "review_findings",
				progress: `Wave ${currentWave} complete — review pending`,
				_stateUpdates: {
					tasks: [...updatedTasks],
					branchLifecycle: cloneBranchLifecycle(updatedBranchLifecycle),
					reviewStatus: summarizeReviewRun(reviewPlan.reviewRun),
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
				updatedBranchLifecycle,
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
		const gateResult = resolveBuildCompletionGate(
			state,
			effectiveTasks,
			buildProgress,
			cloneBranchLifecycle(initialBranchLifecycle),
		);
		if (gateResult.action === "complete" && useWorktrees) {
			await cleanupWorktrees(projectRoot, state.runId);
		}
		return gateResult;
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
		const gateResult = resolveBuildCompletionGate(
			state,
			effectiveTasks,
			buildProgress,
			cloneBranchLifecycle(initialBranchLifecycle),
		);
		if (gateResult.action === "complete" && useWorktrees) {
			await cleanupWorktrees(projectRoot, state.runId);
		}
		return gateResult;
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
		initialBranchLifecycle,
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
