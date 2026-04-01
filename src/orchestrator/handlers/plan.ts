import { getArtifactRef } from "../artifacts";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

export const handlePlan: PhaseHandler = async (_state, _artifactDir, result?) => {
	if (result) {
		return Object.freeze({
			action: "complete",
			phase: "PLAN",
			progress: "Planning complete — tasks written",
		} satisfies DispatchResult);
	}

	const architectRef = getArtifactRef("ARCHITECT", "design.md");
	const challengeRef = getArtifactRef("CHALLENGE", "brief.md");

	const prompt = [
		"Read the architecture design at",
		architectRef,
		"and the challenge brief at",
		challengeRef,
		"then produce a task plan.",
		"Write tasks to phases/PLAN/tasks.md.",
		"Each task should have a 300-line diff max.",
		"Assign wave numbers for parallel execution.",
	].join(" ");

	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.PLAN,
		prompt,
		phase: "PLAN",
		progress: "Dispatching planner",
	} satisfies DispatchResult);
};
