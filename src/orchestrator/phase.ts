import { patchState } from "./state";
import type { Phase, PhaseStatus, PipelineState } from "./types";

/** Maps each phase to its 1-based position for user-facing progress display. */
export const PHASE_INDEX: Readonly<Record<Phase, number>> = Object.freeze({
	RECON: 1,
	CHALLENGE: 2,
	ARCHITECT: 3,
	EXPLORE: 4,
	PLAN: 5,
	BUILD: 6,
	SHIP: 7,
	RETROSPECTIVE: 8,
} satisfies Record<Phase, number>);

export const TOTAL_PHASES = 8;

/**
 * Maps each phase to its valid successor. RETROSPECTIVE is terminal (null).
 */
export const VALID_TRANSITIONS: Readonly<Record<Phase, Phase | null>> = Object.freeze({
	RECON: "CHALLENGE",
	CHALLENGE: "ARCHITECT",
	ARCHITECT: "EXPLORE",
	EXPLORE: "PLAN",
	PLAN: "BUILD",
	BUILD: "SHIP",
	SHIP: "RETROSPECTIVE",
	RETROSPECTIVE: null,
} satisfies Record<Phase, Phase | null>);

/**
 * Throws if the transition from -> to is not allowed by the state machine.
 */
export function validateTransition(from: Phase, to: Phase): void {
	const expected = VALID_TRANSITIONS[from];
	if (expected !== to) {
		throw new Error(
			`Invalid phase transition: ${from} -> ${to}. Expected: ${from} -> ${expected ?? "END"}`,
		);
	}
}

/**
 * Returns the next phase in the pipeline, or null if at terminal phase.
 */
export function getNextPhase(current: Phase): Phase | null {
	return VALID_TRANSITIONS[current];
}

/**
 * Completes the current phase and advances to the next one.
 * Returns a new state object (never mutates the input).
 * Throws if currentPhase is null.
 */
export function completePhase(state: Readonly<PipelineState>): PipelineState {
	if (state.currentPhase === null) {
		throw new Error("Cannot complete phase: no current phase (pipeline may be finished)");
	}

	const currentPhaseName = state.currentPhase;
	const nextPhase = getNextPhase(currentPhaseName);
	const completedAt = new Date().toISOString();

	const updatedPhases = state.phases.map((phase) => {
		if (phase.name === currentPhaseName) {
			return { ...phase, status: "DONE" as const, completedAt };
		}
		if (nextPhase !== null && phase.name === nextPhase) {
			return { ...phase, status: "IN_PROGRESS" as const };
		}
		return phase;
	});

	return patchState(state, {
		status: nextPhase === null ? "COMPLETED" : state.status,
		currentPhase: nextPhase,
		phases: updatedPhases,
		pendingDispatches:
			nextPhase === null
				? []
				: state.pendingDispatches.filter((entry) => entry.phase === nextPhase),
	});
}

/**
 * Skips the current phase (marks it SKIPPED) and advances to the next one.
 * Use when a phase is not needed (e.g., EXPLORE reserved for future use,
 * or CHALLENGE skipped in high-confidence scenarios).
 * Returns a new state object (never mutates the input).
 * Throws if currentPhase is null.
 */
export function skipPhase(state: Readonly<PipelineState>, reason?: string): PipelineState {
	if (state.currentPhase === null) {
		throw new Error("Cannot skip phase: no current phase (pipeline may be finished)");
	}

	const currentPhaseName = state.currentPhase;
	const nextPhase = getNextPhase(currentPhaseName);
	const skippedAt = new Date().toISOString();

	const updatedPhases = state.phases.map((phase) => {
		if (phase.name === currentPhaseName) {
			return { ...phase, status: "SKIPPED" as const, completedAt: skippedAt };
		}
		if (nextPhase !== null && phase.name === nextPhase) {
			return { ...phase, status: "IN_PROGRESS" as const };
		}
		return phase;
	});

	const skipDecision: import("./types").DecisionEntry = {
		phase: currentPhaseName,
		agent: "pipeline",
		decision: `Skipped phase ${currentPhaseName}`,
		rationale: reason ?? "Phase not required for this run",
		timestamp: skippedAt,
	};

	return patchState(state, {
		status: nextPhase === null ? "COMPLETED" : state.status,
		currentPhase: nextPhase,
		phases: updatedPhases,
		decisions: [...state.decisions, skipDecision],
		pendingDispatches:
			nextPhase === null
				? []
				: state.pendingDispatches.filter((entry) => entry.phase === nextPhase),
	});
}

/**
 * Skips forward to a target phase, marking all intermediate phases as SKIPPED.
 * Useful for quick-mode or high-confidence scenarios where multiple phases can be bypassed.
 * Throws if target phase is behind or equal to current phase.
 */
export function skipToPhase(
	state: Readonly<PipelineState>,
	targetPhase: Phase,
	reason?: string,
): PipelineState {
	if (state.currentPhase === null) {
		throw new Error("Cannot skip to phase: no current phase (pipeline may be finished)");
	}

	const currentIndex = PHASE_INDEX[state.currentPhase];
	const targetIndex = PHASE_INDEX[targetPhase];

	if (targetIndex <= currentIndex) {
		throw new Error(
			`Cannot skip backward: ${state.currentPhase} (${currentIndex}) -> ${targetPhase} (${targetIndex})`,
		);
	}

	let current = state;
	while (current.currentPhase !== null && current.currentPhase !== targetPhase) {
		current = skipPhase(current, reason ?? `Skipping to ${targetPhase}`);
	}

	return current;
}

/**
 * Returns the PhaseStatus entry for the given phase name, or undefined if not found.
 */
export function getPhaseStatus(
	state: Readonly<PipelineState>,
	phase: Phase,
): PhaseStatus | undefined {
	return state.phases.find((p) => p.name === phase);
}
