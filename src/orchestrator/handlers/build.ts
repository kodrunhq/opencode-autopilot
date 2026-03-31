import { getArtifactRef } from "../artifacts";
import { groupByWave } from "../plan";
import type { BuildProgress, Task } from "../types";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

const MAX_STRIKES = 3;

/**
 * Find the first wave number that has PENDING tasks.
 */
function findCurrentWave(waveMap: ReadonlyMap<number, readonly Task[]>): number | null {
	const sortedWaves = [...waveMap.keys()].sort((a, b) => a - b);
	for (const wave of sortedWaves) {
		const tasks = waveMap.get(wave)!;
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
 * Build a prompt for a single task dispatch.
 */
function buildTaskPrompt(task: Task): string {
	const planRef = getArtifactRef("PLAN", "tasks.md");
	const designRef = getArtifactRef("ARCHITECT", "design.md");
	return [
		`Implement task ${task.id}: ${task.title}.`,
		`Reference the plan at ${planRef}`,
		`and architecture at ${designRef}.`,
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
		if (Array.isArray(parsed.findings)) {
			return parsed.findings.some(
				(f: unknown) =>
					typeof f === "object" &&
					f !== null &&
					"severity" in f &&
					(f as { severity: string }).severity === "CRITICAL",
			);
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

	// Case 1: Review pending + result provided -> process review outcome
	if (buildProgress.reviewPending && result) {
		if (hasCriticalFindings(result)) {
			// Re-dispatch implementer with fix instructions
			const prompt = [
				`CRITICAL review findings detected. Fix the following issues:`,
				result,
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
			} as DispatchResult);
		}

		// No critical -> advance to next wave
		const waveMap = groupByWave(tasks);
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
			} as DispatchResult);
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
			} as DispatchResult);
		}

		return Object.freeze({
			action: "dispatch_multi",
			agents: pendingTasks.map((task) => ({
				agent: AGENT_NAMES.BUILD,
				prompt: buildTaskPrompt(task),
			})),
			phase: "BUILD",
			progress: `Wave ${nextWave} — ${pendingTasks.length} concurrent tasks`,
			_stateUpdates: {
				buildProgress: { ...updatedProgress, currentTask: pendingTasks[0].id },
			},
		} as DispatchResult);
	}

	// Case 2: Result provided + not review pending -> mark task done
	if (result && !buildProgress.reviewPending && buildProgress.currentTask !== null) {
		const updatedTasks = markTaskDone(tasks, buildProgress.currentTask);
		const waveMap = groupByWave(updatedTasks);
		const currentWave = buildProgress.currentWave ?? 1;

		if (isWaveComplete(waveMap, currentWave)) {
			// Check if there are more waves
			const nextWave = findCurrentWave(waveMap);
			if (nextWave === null) {
				// All done, but need review of final wave
				return Object.freeze({
					action: "dispatch",
					agent: "oc-review",
					prompt: "Review completed wave. Scope: branch. Report any CRITICAL findings.",
					phase: "BUILD",
					progress: `Wave ${currentWave} complete — review pending`,
					_stateUpdates: {
						tasks: updatedTasks,
						buildProgress: {
							...buildProgress,
							currentTask: null,
							reviewPending: true,
						},
					},
				} as DispatchResult);
			}

			// Wave complete but more waves -> trigger review
			return Object.freeze({
				action: "dispatch",
				agent: "oc-review",
				prompt: "Review completed wave. Scope: branch. Report any CRITICAL findings.",
				phase: "BUILD",
				progress: `Wave ${currentWave} complete — review pending`,
				_stateUpdates: {
					tasks: updatedTasks,
					buildProgress: {
						...buildProgress,
						currentTask: null,
						reviewPending: true,
					},
				},
			} as DispatchResult);
		}

		// Wave not complete -> dispatch next pending task in wave
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
					tasks: updatedTasks,
					buildProgress: {
						...buildProgress,
						currentTask: next.id,
					},
				},
			} as DispatchResult);
		}
	}

	// Case 3: No result (first call or resume) -> find first pending wave
	const waveMap = groupByWave(tasks);
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

	if (pendingTasks.length === 0) {
		// All tasks in this wave done, check next
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
		} as DispatchResult);
	}

	// Multiple pending tasks in wave -> dispatch_multi
	return Object.freeze({
		action: "dispatch_multi",
		agents: pendingTasks.map((task) => ({
			agent: AGENT_NAMES.BUILD,
			prompt: buildTaskPrompt(task),
		})),
		phase: "BUILD",
		progress: `Wave ${currentWave} — ${pendingTasks.length} concurrent tasks`,
		_stateUpdates: {
			buildProgress: {
				...buildProgress,
				currentTask: pendingTasks[0].id,
				currentWave,
			},
		},
	} as DispatchResult);
};
