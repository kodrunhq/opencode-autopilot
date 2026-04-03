import { sanitizeTemplateContent } from "../../review/sanitize";
import { getArtifactRef } from "../artifacts";
import { groupByWave } from "../plan";
import type { BuildProgress, Task } from "../types";
import { assignWaves } from "../wave-assigner";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

const MAX_STRIKES = 3;

/**
 * Find the first wave number that has PENDING tasks.
 */
function findCurrentWave(waveMap: ReadonlyMap<number, readonly Task[]>): number | null {
	const sortedWaves = [...waveMap.keys()].sort((a, b) => a - b);
	for (const wave of sortedWaves) {
		const tasks = waveMap.get(wave) ?? [];
		if (tasks.some((t) => t.status === "PENDING" || t.status === "IN_PROGRESS")) {
			return wave;
		}
	}
	return null;
}

/**
 * Get pending tasks for a specific wave.
 */
function findPendingTasks(
	waveMap: ReadonlyMap<number, readonly Task[]>,
	wave: number,
): readonly Task[] {
	const tasks = waveMap.get(wave) ?? [];
	return tasks.filter((t) => t.status === "PENDING");
}

/**
 * Get in-progress tasks for a specific wave.
 */
function findInProgressTasks(
	waveMap: ReadonlyMap<number, readonly Task[]>,
	wave: number,
): readonly Task[] {
	const tasks = waveMap.get(wave) ?? [];
	return tasks.filter((t) => t.status === "IN_PROGRESS");
}

/**
 * Mark multiple tasks as IN_PROGRESS immutably.
 */
function markTasksInProgress(tasks: readonly Task[], taskIds: readonly number[]): readonly Task[] {
	const idSet = new Set(taskIds);
	return tasks.map((t) => (idSet.has(t.id) ? { ...t, status: "IN_PROGRESS" as const } : t));
}

/**
 * Build a prompt for a single task dispatch.
 */
function buildTaskPrompt(task: Task): string {
	const planRef = getArtifactRef("PLAN", "tasks.md");
	const designRef = getArtifactRef("ARCHITECT", "design.md");
	return [
		`Implement task ${task.id}: ${task.title}.`,
		`Reference the plan at ${planRef}`,
		`and architecture at ${designRef}.`,
		`If a CLAUDE.md file exists in the project root, read it for project-specific conventions.`,
		`Check ~/.config/opencode/skills/coding-standards/SKILL.md for coding standards.`,
		`Report completion when done.`,
	].join(" ");
}

/**
 * Mark a task as DONE immutably and return the updated tasks array.
 */
function markTaskDone(tasks: readonly Task[], taskId: number): readonly Task[] {
	return tasks.map((t) => (t.id === taskId ? { ...t, status: "DONE" as const } : t));
}

/**
 * Check whether all tasks in a given wave are DONE.
 */
function isWaveComplete(waveMap: ReadonlyMap<number, readonly Task[]>, wave: number): boolean {
	const tasks = waveMap.get(wave) ?? [];
	return tasks.every((t) => t.status === "DONE");
}

/**
 * Parse review result to check for CRITICAL findings.
 */
function hasCriticalFindings(resultStr: string): boolean {
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

export const handleBuild: PhaseHandler = async (state, _artifactDir, result?) => {
	const { tasks, buildProgress } = state;

	// Edge case: no tasks
	if (tasks.length === 0) {
		return Object.freeze({
			action: "error",
			phase: "BUILD",
			message: "No tasks found",
		} satisfies DispatchResult);
	}

	// Edge case: strike count exceeded
	if (buildProgress.strikeCount > MAX_STRIKES && buildProgress.reviewPending && result) {
		return Object.freeze({
			action: "error",
			phase: "BUILD",
			message: "Max retries exceeded — too many CRITICAL review findings",
		} satisfies DispatchResult);
	}

	// Auto-assign waves from depends_on declarations (D-15)
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

	// Check if all remaining tasks are BLOCKED (cycles or MAX_TASKS cap)
	const nonDoneTasks = effectiveTasks.filter((t) => t.status !== "DONE" && t.status !== "SKIPPED");
	if (nonDoneTasks.length > 0 && nonDoneTasks.every((t) => t.status === "BLOCKED")) {
		const blockedIds = nonDoneTasks.map((t) => t.id).join(", ");
		return Object.freeze({
			action: "error" as const,
			progress: `All remaining tasks are BLOCKED due to dependency cycles: [${blockedIds}]`,
			_stateUpdates: Object.freeze({
				buildProgress: Object.freeze({
					...buildProgress,
				}),
				tasks: effectiveTasks,
			}),
		});
	}

	// Case 1: Review pending + result provided -> process review outcome
	if (buildProgress.reviewPending && result) {
		if (hasCriticalFindings(result)) {
			// Re-dispatch implementer with fix instructions
			const safeResult = sanitizeTemplateContent(result).slice(0, 4000);
			const prompt = [
				`CRITICAL review findings detected. Fix the following issues:`,
				safeResult,
				`Reference ${getArtifactRef("PLAN", "tasks.md")} for context.`,
			].join(" ");

			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.BUILD,
				prompt,
				phase: "BUILD",
				progress: "Fix dispatch — CRITICAL findings",
				_stateUpdates: {
					buildProgress: {
						...buildProgress,
						strikeCount: buildProgress.strikeCount + 1,
					},
				},
			} satisfies DispatchResult);
		}

		// No critical -> advance to next wave
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
						reviewPending: false,
					},
				},
			} satisfies DispatchResult);
		}

		const pendingTasks = findPendingTasks(waveMap, nextWave);
		const updatedProgress: BuildProgress = {
			...buildProgress,
			reviewPending: false,
			currentWave: nextWave,
		};

		if (pendingTasks.length === 1) {
			const task = pendingTasks[0];
			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.BUILD,
				prompt: buildTaskPrompt(task),
				phase: "BUILD",
				progress: `Wave ${nextWave} — task ${task.id}`,
				_stateUpdates: {
					buildProgress: { ...updatedProgress, currentTask: task.id },
				},
			} satisfies DispatchResult);
		}

		const dispatchedIds = pendingTasks.map((t) => t.id);
		return Object.freeze({
			action: "dispatch_multi",
			agents: pendingTasks.map((task) => ({
				agent: AGENT_NAMES.BUILD,
				prompt: buildTaskPrompt(task),
			})),
			phase: "BUILD",
			progress: `Wave ${nextWave} — ${pendingTasks.length} concurrent tasks`,
			_stateUpdates: {
				tasks: [...markTasksInProgress(effectiveTasks, dispatchedIds)],
				buildProgress: { ...updatedProgress, currentTask: null },
			},
		} satisfies DispatchResult);
	}

	// Case 2: Result provided + not review pending -> mark task done
	// For dispatch_multi, currentTask may be null — find the first IN_PROGRESS task instead
	const taskToComplete =
		buildProgress.currentTask ?? effectiveTasks.find((t) => t.status === "IN_PROGRESS")?.id ?? null;
	if (result && !buildProgress.reviewPending && taskToComplete !== null) {
		const updatedTasks = markTaskDone(effectiveTasks, taskToComplete);
		const waveMap = groupByWave(updatedTasks);
		const currentWave = buildProgress.currentWave ?? 1;

		if (isWaveComplete(waveMap, currentWave)) {
			// Wave complete -> trigger review (same for final wave or intermediate)
			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.REVIEW,
				prompt: "Review completed wave. Scope: branch. Report any CRITICAL findings.",
				phase: "BUILD",
				progress: `Wave ${currentWave} complete — review pending`,
				_stateUpdates: {
					tasks: [...updatedTasks],
					buildProgress: {
						...buildProgress,
						currentTask: null,
						reviewPending: true,
					},
				},
			} satisfies DispatchResult);
		}

		// Wave not complete -> dispatch next pending task or wait for in-progress
		const pendingInWave = findPendingTasks(waveMap, currentWave);
		if (pendingInWave.length > 0) {
			const next = pendingInWave[0];
			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.BUILD,
				prompt: buildTaskPrompt(next),
				phase: "BUILD",
				progress: `Wave ${currentWave} — task ${next.id}`,
				_stateUpdates: {
					tasks: [...updatedTasks],
					buildProgress: {
						...buildProgress,
						currentTask: next.id,
					},
				},
			} satisfies DispatchResult);
		}

		// No pending tasks but wave not complete — other tasks are still IN_PROGRESS
		const inProgressInWave = findInProgressTasks(waveMap, currentWave);
		if (inProgressInWave.length > 0) {
			return Object.freeze({
				action: "dispatch",
				agent: AGENT_NAMES.BUILD,
				prompt: `Wave ${currentWave} has ${inProgressInWave.length} task(s) still in progress. Continue working on remaining tasks.`,
				phase: "BUILD",
				progress: `Wave ${currentWave} — waiting for ${inProgressInWave.length} in-progress task(s)`,
				_stateUpdates: {
					tasks: [...updatedTasks],
					buildProgress: {
						...buildProgress,
						currentTask: null,
					},
				},
			} satisfies DispatchResult);
		}
	}

	// Case 3: No result (first call or resume) -> find first pending wave
	const waveMap = groupByWave(effectiveTasks);
	const currentWave = findCurrentWave(waveMap);

	if (currentWave === null) {
		// All tasks already DONE
		return Object.freeze({
			action: "complete",
			phase: "BUILD",
			progress: "All tasks complete",
		} satisfies DispatchResult);
	}

	const pendingTasks = findPendingTasks(waveMap, currentWave);
	const inProgressTasks = findInProgressTasks(waveMap, currentWave);

	if (pendingTasks.length === 0 && inProgressTasks.length > 0) {
		// Wave has only IN_PROGRESS tasks (e.g., resume after dispatch_multi).
		// Return a dispatch instruction so the orchestrator knows work is underway.
		return Object.freeze({
			action: "dispatch",
			agent: AGENT_NAMES.BUILD,
			prompt: `Resume: wave ${currentWave} has ${inProgressTasks.length} task(s) still in progress. Wait for agent results and pass them back.`,
			phase: "BUILD",
			progress: `Wave ${currentWave} — waiting for ${inProgressTasks.length} in-progress task(s)`,
			_stateUpdates: {
				buildProgress: {
					...buildProgress,
					currentWave,
					currentTask: null,
				},
			},
		} satisfies DispatchResult);
	}

	if (pendingTasks.length === 0) {
		// All tasks in all waves DONE (findCurrentWave already checked PENDING + IN_PROGRESS)
		return Object.freeze({
			action: "complete",
			phase: "BUILD",
			progress: "All tasks complete",
		} satisfies DispatchResult);
	}

	if (pendingTasks.length === 1) {
		const task = pendingTasks[0];
		return Object.freeze({
			action: "dispatch",
			agent: AGENT_NAMES.BUILD,
			prompt: buildTaskPrompt(task),
			phase: "BUILD",
			progress: `Wave ${currentWave} — task ${task.id}`,
			_stateUpdates: {
				buildProgress: {
					...buildProgress,
					currentTask: task.id,
					currentWave,
				},
			},
		} satisfies DispatchResult);
	}

	// Multiple pending tasks in wave -> dispatch_multi
	const dispatchedIds = pendingTasks.map((t) => t.id);
	return Object.freeze({
		action: "dispatch_multi",
		agents: pendingTasks.map((task) => ({
			agent: AGENT_NAMES.BUILD,
			prompt: buildTaskPrompt(task),
		})),
		phase: "BUILD",
		progress: `Wave ${currentWave} — ${pendingTasks.length} concurrent tasks`,
		_stateUpdates: {
			tasks: [...markTasksInProgress(effectiveTasks, dispatchedIds)],
			buildProgress: {
				...buildProgress,
				currentTask: null,
				currentWave,
			},
		},
	} satisfies DispatchResult);
};
