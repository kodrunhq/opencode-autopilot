import type { Phase, PipelineState } from "./types";
import { PHASES } from "./schemas";

/**
 * Generate a concise progress string for the user indicating current phase and progress.
 * e.g., "[1/8] Analyzing requirements..." or "[6/8] Building wave 2 of 5..."
 */
export function getPhaseProgressString(state: PipelineState): string {
	const currentPhase = state.currentPhase;
	if (!currentPhase) {
		if (state.status === "COMPLETED") return "[Done] Pipeline finished successfully.";
		if (state.status === "FAILED") return "[Failed] Pipeline encountered an error.";
		return "[0/8] Not started";
	}

	const phaseIndex = PHASES.indexOf(currentPhase as any) + 1;
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
				return `${baseProgress} Starting build phase...`;
			}

			// Find max wave to show total waves
			const allWaves = state.tasks.map((t) => t.wave);
			const totalWaves = allWaves.length > 0 ? Math.max(...allWaves) : 0;
			const totalTasksInWave = state.tasks.filter((t) => t.wave === progress.currentWave).length;

			if (progress.reviewPending) {
				return `${baseProgress} Reviewing wave ${progress.currentWave}/${totalWaves}...`;
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
