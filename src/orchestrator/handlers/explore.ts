import type { DispatchResult, PhaseHandler } from "./types";

export const handleExplore: PhaseHandler = async (_state, _artifactDir, _result?) => {
	return Object.freeze({
		action: "complete",
		resultKind: "phase_output",
		phase: "EXPLORE",
		progress: "EXPLORE skipped (not yet implemented)",
	} satisfies DispatchResult);
};
