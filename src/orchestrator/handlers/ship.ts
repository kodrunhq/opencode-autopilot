import { getArtifactRef } from "../artifacts";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

export const handleShip: PhaseHandler = async (_state, _artifactDir, result?) => {
	if (result) {
		return Object.freeze({
			action: "complete",
			phase: "SHIP",
			progress: "Shipping complete — documentation written",
		} satisfies DispatchResult);
	}

	const reconRef = getArtifactRef("RECON", "report.md");
	const challengeRef = getArtifactRef("CHALLENGE", "brief.md");
	const architectRef = getArtifactRef("ARCHITECT", "design.md");
	const planRef = getArtifactRef("PLAN", "tasks.md");

	const prompt = [
		"Review all prior phase artifacts:",
		`${reconRef},`,
		`${challengeRef},`,
		`${architectRef},`,
		`${planRef}.`,
		"Produce walkthrough.md (architecture overview),",
		"decisions.md (key decisions with rationale),",
		"changelog.md (user-facing changes).",
		"Write output to phases/SHIP/.",
	].join(" ");

	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.SHIP,
		prompt,
		phase: "SHIP",
		progress: "Dispatching shipper",
	} satisfies DispatchResult);
};
