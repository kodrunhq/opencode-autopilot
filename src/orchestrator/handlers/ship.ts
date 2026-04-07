import { fileExists } from "../../utils/fs-helpers";
import { getArtifactRef, getPhaseDir } from "../artifacts";
import { buildPrBody, shouldCreatePr } from "./branch-pr";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

function buildPrInstructions(state: Parameters<PhaseHandler>[0]): string {
	const bl = state.branchLifecycle;
	if (!bl || !shouldCreatePr(bl)) return "";

	const prBody = buildPrBody(bl, { idea: state.idea });
	return [
		"",
		"## PR Creation Instructions",
		`Create a pull request from branch \`${bl.currentBranch}\` into \`${bl.baseBranch}\`.`,
		`Title: ${state.idea.slice(0, 72)}`,
		"",
		"PR body:",
		"```markdown",
		prBody,
		"```",
	].join("\n");
}

export const handleShip: PhaseHandler = async (state, artifactDir, result?) => {
	if (result) {
		const shipDir = getPhaseDir(artifactDir, "SHIP");
		const walkthroughExists = await fileExists(
			getArtifactRef(artifactDir, "SHIP", "walkthrough.md"),
		);
		const changelogExists = await fileExists(getArtifactRef(artifactDir, "SHIP", "changelog.md"));
		if (!walkthroughExists && !changelogExists) {
			return Object.freeze({
				action: "error",
				phase: "SHIP",
				message: `SHIP agent returned a result but did not write required artifacts in ${shipDir}. At least walkthrough.md or changelog.md must exist.`,
			} satisfies DispatchResult);
		}
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

	const prInstructions = buildPrInstructions(state);

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
		prInstructions,
	]
		.filter(Boolean)
		.join(" ");

	return Object.freeze({
		action: "dispatch",
		agent: AGENT_NAMES.SHIP,
		resultKind: "phase_output",
		prompt,
		phase: "SHIP",
		progress: "Dispatching shipper",
	} satisfies DispatchResult);
};
