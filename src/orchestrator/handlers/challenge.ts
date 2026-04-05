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
		// Warn if artifact wasn't written (best-effort — still complete the phase)
		const artifactPath = getArtifactRef(artifactDir, "CHALLENGE", "brief.md");
		if (!(await fileExists(artifactPath))) {
			logger.warn("CHALLENGE completed but artifact not found", {
				operation: "phase_transition",
				phase: "CHALLENGE",
				artifactPath,
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
			`Original idea: ${safeIdea}`,
			`Propose up to 3 enhancements. Write ambitious brief to ${outputPath}`,
			`For each: name, user value, complexity (LOW/MEDIUM/HIGH), accept/reject rationale.`,
		].join("\n"),
		phase: "CHALLENGE",
		progress: "Dispatching challenger for product enhancements",
	});
}
