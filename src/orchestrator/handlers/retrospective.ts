import { getArtifactRef, PHASE_ARTIFACTS } from "../artifacts";
import type { Phase } from "../types";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

export const handleRetrospective: PhaseHandler = async (_state, _artifactDir, result?) => {
	if (result) {
		return Object.freeze({
			action: "complete",
			phase: "RETROSPECTIVE",
			progress: "Retrospective complete — lessons extracted",
		} satisfies DispatchResult);
	}

	const artifactRefs = Object.entries(PHASE_ARTIFACTS)
		.filter(([_, files]) => files.length > 0)
		.flatMap(([phase, files]) => files.map((file) => getArtifactRef(phase as Phase, file)));

	const prompt = [
		"Analyze all phase artifacts:",
		`${artifactRefs.join(", ")}.`,
		"Categorize lessons by domain: architecture, testing, review, planning.",
		"Write output to phases/RETROSPECTIVE/lessons.md.",
	].join(" ");

	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.RETROSPECTIVE,
		prompt,
		phase: "RETROSPECTIVE",
		progress: "Dispatching retrospector",
	} satisfies DispatchResult);
};
