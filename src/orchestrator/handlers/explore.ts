import type { DispatchResult, PhaseHandler } from "./types";

export const handleExplore: PhaseHandler = async (_state, _artifactDir, _result?) => {
	return Object.freeze({
		action: "complete",
		phase: "EXPLORE",
		progress: "EXPLORE skipped (not yet implemented)",
	} satisfies DispatchResult);
};
