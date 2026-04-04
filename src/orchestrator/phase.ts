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
 * Returns the PhaseStatus entry for the given phase name, or undefined if not found.
 */
export function getPhaseStatus(
	state: Readonly<PipelineState>,
	phase: Phase,
): PhaseStatus | undefined {
	return state.phases.find((p) => p.name === phase);
}
