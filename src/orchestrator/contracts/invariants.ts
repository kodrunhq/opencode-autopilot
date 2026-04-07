import type { PipelineState } from "../types";

export interface InvariantViolation {
	readonly code: string;
	readonly message: string;
}

function hasSingleInProgressPhase(state: Readonly<PipelineState>): boolean {
	const count = state.phases.filter((phase) => phase.status === "IN_PROGRESS").length;
	if (state.currentPhase === null) {
		return true;
	}
	return count === 1;
}

function hasMatchingCurrentPhase(state: Readonly<PipelineState>): boolean {
	if (state.currentPhase === null) {
		return true;
	}
	const phase = state.phases.find((item) => item.name === state.currentPhase);
	return phase?.status === "IN_PROGRESS";
}

function isTerminalStatus(state: Readonly<PipelineState>): boolean {
	return state.status === "COMPLETED" || state.status === "FAILED";
}

function buildTaskExists(state: Readonly<PipelineState>, taskId: number): boolean {
	return state.tasks.some((task) => task.id === taskId);
}

function collectPendingDispatchKeys(state: Readonly<PipelineState>): readonly string[] {
	return state.pendingDispatches.map((entry) => `${entry.dispatchId}|${entry.phase}`);
}

function hasPendingDispatchOutsideCurrentPhase(state: Readonly<PipelineState>): boolean {
	if (state.currentPhase === null) {
		return state.pendingDispatches.length > 0;
	}
	return state.pendingDispatches.some((entry) => entry.phase !== state.currentPhase);
}

export function validateStateInvariants(
	state: Readonly<PipelineState>,
): readonly InvariantViolation[] {
	const violations: InvariantViolation[] = [];

	if (state.currentPhase === null && !isTerminalStatus(state)) {
		violations.push({
			code: "E_INVARIANT_PHASE_TERMINAL",
			message: "currentPhase is null while status is non-terminal",
		});
	}

	if (state.currentPhase !== null && isTerminalStatus(state)) {
		if (state.status === "COMPLETED") {
			violations.push({
				code: "E_INVARIANT_PHASE_ACTIVE",
				message: "currentPhase is set while status is terminal",
			});
		}
	}

	if (!hasSingleInProgressPhase(state)) {
		violations.push({
			code: "E_INVARIANT_IN_PROGRESS_COUNT",
			message: "phase status must have exactly one IN_PROGRESS when pipeline is active",
		});
	}

	if (!hasMatchingCurrentPhase(state)) {
		violations.push({
			code: "E_INVARIANT_CURRENT_PHASE_MISMATCH",
			message: "currentPhase does not match an IN_PROGRESS phase entry",
		});
	}

	if (
		state.buildProgress.currentTask !== null &&
		!buildTaskExists(state, state.buildProgress.currentTask)
	) {
		violations.push({
			code: "E_INVARIANT_BUILD_TASK",
			message: "buildProgress.currentTask references unknown task",
		});
	}

	for (const taskId of state.buildProgress.currentTasks) {
		if (!buildTaskExists(state, taskId)) {
			violations.push({
				code: "E_INVARIANT_BUILD_TASK",
				message: `buildProgress.currentTasks references unknown task ${taskId}`,
			});
		}
	}

	if (state.buildProgress.reviewPending && state.currentPhase !== "BUILD") {
		violations.push({
			code: "E_INVARIANT_REVIEW_PHASE",
			message: "buildProgress.reviewPending is true outside BUILD phase",
		});
	}

	const pendingKeys = collectPendingDispatchKeys(state);
	if (new Set(pendingKeys).size !== pendingKeys.length) {
		violations.push({
			code: "E_INVARIANT_PENDING_DISPATCH_DUP",
			message: "pendingDispatches contains duplicate dispatch-phase keys",
		});
	}

	if (hasPendingDispatchOutsideCurrentPhase(state)) {
		violations.push({
			code: "E_INVARIANT_PENDING_PHASE",
			message: "pendingDispatches must belong to the current active phase only",
		});
	}

	const processedIds = state.processedResultIds;
	if (new Set(processedIds).size !== processedIds.length) {
		violations.push({
			code: "E_INVARIANT_RESULT_ID_DUP",
			message: "processedResultIds contains duplicate result IDs",
		});
	}

	if (state.stateRevision < 0 || !Number.isInteger(state.stateRevision)) {
		violations.push({
			code: "E_INVARIANT_REVISION",
			message: "stateRevision must be a non-negative integer",
		});
	}

	return Object.freeze(violations);
}

export function assertStateInvariants(state: Readonly<PipelineState>): void {
	const violations = validateStateInvariants(state);
	if (violations.length === 0) {
		return;
	}
	const top = violations[0];
	throw new Error(`${top.code}: ${top.message}`);
}
