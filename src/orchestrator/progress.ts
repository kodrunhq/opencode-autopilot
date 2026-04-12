import { PHASES } from "./schemas";
import type { PipelineState, Task } from "./types";

const PHASE_INDEX = Object.freeze(
	Object.fromEntries(PHASES.map((phase, index) => [phase, index + 1])) as Record<
		(typeof PHASES)[number],
		number
	>,
);

/**
 * Generate a concise progress string for the user indicating current phase and progress.
 * e.g., "[1/8] Analyzing requirements..." or "[6/8] Building wave 2 of 5..."
 */
export function getPhaseProgressString(state: PipelineState): string {
	const currentPhase = state.currentPhase;
	if (!currentPhase) {
		if (state.status === "COMPLETED") return "[Done] Pipeline finished successfully.";
		if (state.status === "FAILED") return "[Failed] Pipeline encountered an error.";
		return `[0/${PHASES.length}] Not started`;
	}

	const phaseIndex = PHASE_INDEX[currentPhase];
	const totalPhases = PHASES.length;
	const baseProgress = `[${phaseIndex}/${totalPhases}]`;

	switch (currentPhase) {
		case "RECON":
			return `${baseProgress} Researching feasibility and codebase context...`;
		case "CHALLENGE":
			return `${baseProgress} Evaluating architecture enhancements...`;
		case "ARCHITECT":
			return `${baseProgress} Designing technical architecture...`;
		case "EXPLORE":
			return `${baseProgress} Exploring implementation paths...`;
		case "PLAN":
			return `${baseProgress} Planning implementation waves...`;
		case "BUILD": {
			const progress = state.buildProgress;
			if (!progress || progress.currentWave === null) {
				if (progress?.oraclePending) {
					return `${baseProgress} Awaiting tranche Oracle signoff...`;
				}
				return `${baseProgress} Starting build phase...`;
			}

			// Find max wave to show total waves
			const allWaves = state.tasks.map((t) => t.wave);
			const totalWaves = allWaves.length > 0 ? Math.max(...allWaves) : 0;
			const totalTasksInWave = state.tasks.filter((t) => t.wave === progress.currentWave).length;

			if (progress.reviewPending) {
				const completedReviewers = state.reviewStatus.reviewers.filter(
					(reviewer) => reviewer.status === "COMPLETED",
				).length;
				const totalReviewers = state.reviewStatus.reviewers.length;
				if (totalReviewers > 0) {
					return `${baseProgress} Review stage for wave ${progress.currentWave}/${totalWaves} (${completedReviewers}/${totalReviewers} reviewers complete)...`;
				}
				return `${baseProgress} Reviewing wave ${progress.currentWave}/${totalWaves}...`;
			}

			if (progress.oraclePending) {
				return `${baseProgress} Awaiting tranche Oracle signoff...`;
			}

			// Just a sensible string for current build status
			return `${baseProgress} Building wave ${progress.currentWave}/${totalWaves} (${totalTasksInWave} tasks)...`;
		}
		case "SHIP":
			return `${baseProgress} Generating changelog and documentation...`;
		case "RETROSPECTIVE":
			return `${baseProgress} Extracting lessons learned...`;
		default:
			return `${baseProgress} Executing ${currentPhase}...`;
	}
}

export function getActiveTasks(state: Readonly<PipelineState>): readonly Task[] {
	const activeTaskIds = new Set(state.buildProgress.currentTasks);
	return Object.freeze(
		state.tasks.filter((task) => activeTaskIds.has(task.id) || task.status === "IN_PROGRESS"),
	);
}

export function getRemainingTaskBacklog(state: Readonly<PipelineState>): readonly Task[] {
	return Object.freeze(
		state.tasks.filter((task) => task.status !== "DONE" && task.status !== "SKIPPED"),
	);
}

export function getPipelineBlockedReason(state: Readonly<PipelineState>): string | null {
	if (state.reviewStatus.blockedReason) {
		return state.reviewStatus.blockedReason;
	}

	const trancheOracle = state.oracleSignoffs.tranche;
	if (trancheOracle?.verdict === "FAIL") {
		return trancheOracle.blockingConditions.join("; ") || trancheOracle.reasoning;
	}

	if (
		(state.verificationStatus.status === "FAILED" ||
			state.verificationStatus.status === "BLOCKED") &&
		state.verificationStatus.summary
	) {
		return state.verificationStatus.summary;
	}

	if (state.failureContext?.errorMessage) {
		return state.failureContext.errorMessage;
	}

	const blockedTasks = state.tasks.filter((task) => task.status === "BLOCKED");
	if (blockedTasks.length > 0) {
		return blockedTasks.map((task) => `Task ${task.id}: ${task.title}`).join("; ");
	}

	return null;
}
