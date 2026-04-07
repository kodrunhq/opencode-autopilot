import { getLogger } from "../../logging/domains";
import { sanitizeTemplateContent } from "../../review/sanitize";
import { fileExists } from "../../utils/fs-helpers";
import { ensurePhaseDir, getArtifactRef } from "../artifacts";
import type { PipelineState } from "../types";
import { AGENT_NAMES, type DispatchResult, type PhaseHandlerContext } from "./types";

const logger = getLogger("orchestrator", "challenge");

/**
 * CHALLENGE phase handler — dispatches oc-challenger with RECON artifact references.
 * References files by path (not content injection) per D-11.
 */
export async function handleChallenge(
	state: Readonly<PipelineState>,
	artifactDir: string,
	result?: string,
	_context?: PhaseHandlerContext,
): Promise<DispatchResult> {
	if (result) {
		const artifactPath = getArtifactRef(artifactDir, "CHALLENGE", "brief.md");
		if (!(await fileExists(artifactPath))) {
			logger.warn("CHALLENGE result received but artifact not found", {
				operation: "phase_transition",
				phase: "CHALLENGE",
				artifactPath,
			});
			return Object.freeze({
				action: "error" as const,
				phase: "CHALLENGE",
				message: `CHALLENGE agent returned a result but did not write the required artifact: ${artifactPath}. The agent must write brief.md before the phase can complete.`,
			});
		}
		return Object.freeze({
			action: "complete" as const,
			phase: "CHALLENGE",
			progress: "CHALLENGE complete",
		});
	}

	await ensurePhaseDir(artifactDir, "CHALLENGE");
	const reconRef = getArtifactRef(artifactDir, "RECON", "report.md");
	const outputPath = getArtifactRef(artifactDir, "CHALLENGE", "brief.md");

	const safeIdea = sanitizeTemplateContent(state.idea).replace(/[\r\n]+/g, " ");

	return Object.freeze({
		action: "dispatch" as const,
		agent: AGENT_NAMES.CHALLENGE,
		resultKind: "phase_output",
		prompt: [
			`Read ${reconRef} for research context.`,
			"",
			`Original idea: ${safeIdea}`,
			"",
			`Write an enhancement brief to ${outputPath} containing up to 3 proposed enhancements.`,
			"",
			"For EACH enhancement, include these fields:",
			"",
			"### Enhancement N: <Name>",
			"- **User Value**: What concrete problem does this solve or what capability does it unlock?",
			"- **Complexity**: LOW / MEDIUM / HIGH",
			"- **Dependencies**: What must exist first? (prior phases, external APIs, infra)",
			"- **Risk**: What could go wrong and how to mitigate it",
			"- **Accept/Reject**: ACCEPT or REJECT with one-sentence rationale",
			"",
			"After listing all enhancements, add a summary section:",
			"",
			"## Recommendation",
			"- Which enhancements should proceed and in what priority order",
			"- Combined complexity impact on the original idea",
			"- Any enhancements that conflict with each other",
			"",
			"Be ambitious but grounded — enhancements should be achievable",
			"within the scope of the original idea, not scope-doubling tangents.",
		].join("\n"),
		phase: "CHALLENGE",
		progress: "Dispatching challenger for product enhancements",
	});
}
