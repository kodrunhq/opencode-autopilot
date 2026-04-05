import type { PipelineState } from "./types";

export function enrichErrorMessage(error: string, state: PipelineState): string {
	const phase = state.currentPhase ?? "UNKNOWN";
	const details: string[] = [];

	if (
		state.currentPhase === "BUILD" &&
		state.buildProgress?.currentWave !== null &&
		state.buildProgress?.currentWave !== undefined
	) {
		details.push(`wave ${state.buildProgress.currentWave}`);
	}

	if (state.buildProgress?.currentTask !== null && state.buildProgress?.currentTask !== undefined) {
		const task = state.tasks.find((entry) => entry.id === state.buildProgress.currentTask);
		details.push(
			task ? `task ${task.id}: ${task.title}` : `task ${state.buildProgress.currentTask}`,
		);
	}

	const context = details.length > 0 ? ` (${details.join(", ")})` : "";
	return `Error in phase ${phase}${context}: ${error}`;
}
