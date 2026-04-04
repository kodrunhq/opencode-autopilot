import { fileExists } from "../../utils/fs-helpers";
import { getArtifactRef, getPhaseDir } from "../artifacts";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

export const handleShip: PhaseHandler = async (_state, artifactDir, result?) => {
	if (result) {
		return Object.freeze({
			action: "complete",
			resultKind: "phase_output",
			phase: "SHIP",
			progress: "Shipping complete — documentation written",
		} satisfies DispatchResult);
	}

	const reconRef = getArtifactRef(artifactDir, "RECON", "report.md");
	const challengeRef = getArtifactRef(artifactDir, "CHALLENGE", "brief.md");
	const architectRef = getArtifactRef(artifactDir, "ARCHITECT", "design.md");
	const tasksJsonRef = getArtifactRef(artifactDir, "PLAN", "tasks.json");
	const tasksMarkdownRef = getArtifactRef(artifactDir, "PLAN", "tasks.md");
	const planRef = (await fileExists(tasksJsonRef)) ? tasksJsonRef : tasksMarkdownRef;
	const shipDir = getPhaseDir(artifactDir, "SHIP");

	const prompt = [
		"Review all prior phase artifacts:",
		`${reconRef},`,
		`${challengeRef},`,
		`${architectRef},`,
		`${planRef}.`,
		"Produce walkthrough.md (architecture overview),",
		"decisions.md (key decisions with rationale),",
		"changelog.md (user-facing changes).",
		`Write output to ${shipDir}/.`,
	].join(" ");

	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.SHIP,
		resultKind: "phase_output",
		prompt,
		phase: "SHIP",
		progress: "Dispatching shipper",
	} satisfies DispatchResult);
};
