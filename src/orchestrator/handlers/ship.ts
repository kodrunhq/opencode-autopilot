import { fileExists } from "../../utils/fs-helpers";
import { getArtifactRef, getPhaseDir } from "../artifacts";
import { buildPrBody, recordPrCreation, shouldCreatePr } from "./branch-pr";
import { cloneBranchLifecycle } from "./build-utils";
import type { DispatchResult, PhaseHandler } from "./types";
import { AGENT_NAMES } from "./types";

const PR_URL_PATTERN = /https?:\/\/[^\s)]+\/pull\/(\d+)(?:[/?#][^\s)]*)?/i;

function extractCreatedPr(
	resultText: string,
): { readonly prNumber: number; readonly prUrl: string } | null {
	const match = resultText.match(PR_URL_PATTERN);
	if (!match) return null;

	const prNumber = Number(match[1]);
	if (!Number.isInteger(prNumber) || prNumber < 1) {
		return null;
	}

	return Object.freeze({
		prNumber,
		prUrl: match[0],
	});
}

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
		const shipDir = getPhaseDir(artifactDir, "SHIP", state.runId);
		const walkthroughExists = await fileExists(
			getArtifactRef(artifactDir, "SHIP", "walkthrough.md", state.runId),
		);
		const changelogExists = await fileExists(
			getArtifactRef(artifactDir, "SHIP", "changelog.md", state.runId),
		);
		const decisionsExists = await fileExists(
			getArtifactRef(artifactDir, "SHIP", "decisions.md", state.runId),
		);
		if (!walkthroughExists && !changelogExists && !decisionsExists) {
			return Object.freeze({
				action: "error",
				phase: "SHIP",
				message: `SHIP agent returned a result but did not write required artifacts in ${shipDir}. At least one of walkthrough.md, decisions.md, or changelog.md must exist.`,
			} satisfies DispatchResult);
		}

		// Best-effort until SHIP results expose structured PR metadata directly.
		const createdPr =
			state.branchLifecycle && state.branchLifecycle.prNumber === null
				? extractCreatedPr(result)
				: null;
		const branchLifecycle =
			createdPr && state.branchLifecycle
				? recordPrCreation(state.branchLifecycle, createdPr.prNumber, createdPr.prUrl)
				: null;

		return Object.freeze({
			action: "complete",
			resultKind: "phase_output",
			phase: "SHIP",
			progress: "Shipping complete — documentation written",
			...(branchLifecycle
				? { _stateUpdates: { branchLifecycle: cloneBranchLifecycle(branchLifecycle) } }
				: {}),
		} satisfies DispatchResult);
	}

	const reconRef = getArtifactRef(artifactDir, "RECON", "report.md", state.runId);
	const challengeRef = getArtifactRef(artifactDir, "CHALLENGE", "brief.md", state.runId);
	const architectRef = getArtifactRef(artifactDir, "ARCHITECT", "design.md", state.runId);
	const tasksJsonRef = getArtifactRef(artifactDir, "PLAN", "tasks.json", state.runId);
	const tasksMarkdownRef = getArtifactRef(artifactDir, "PLAN", "tasks.md", state.runId);
	const planRef = (await fileExists(tasksJsonRef)) ? tasksJsonRef : tasksMarkdownRef;
	const shipDir = getPhaseDir(artifactDir, "SHIP", state.runId);

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
