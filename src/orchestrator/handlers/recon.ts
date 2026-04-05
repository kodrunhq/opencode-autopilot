import { getLogger } from "../../logging/domains";
import { sanitizeTemplateContent } from "../../review/sanitize";
import { fileExists } from "../../utils/fs-helpers";
import { ensurePhaseDir, getArtifactRef } from "../artifacts";
import type { PipelineState } from "../types";
import { AGENT_NAMES, type DispatchResult, type PhaseHandlerContext } from "./types";

const logger = getLogger("orchestrator", "recon");

/**
 * RECON phase handler — dispatches oc-researcher with idea and artifact path.
 * Uses file references (not content injection) per D-11.
 */
export async function handleRecon(
	state: Readonly<PipelineState>,
	artifactDir: string,
	result?: string,
	_context?: PhaseHandlerContext,
): Promise<DispatchResult> {
	if (result) {
		// Warn if artifact wasn't written (best-effort — still complete the phase)
		const artifactPath = getArtifactRef(artifactDir, "RECON", "report.md");
		if (!(await fileExists(artifactPath))) {
			logger.warn("RECON completed but artifact not found", {
				operation: "phase_transition",
				phase: "RECON",
				artifactPath,
			});
		}
		return Object.freeze({
			action: "complete" as const,
			phase: "RECON",
			progress: "RECON complete",
		});
	}

	await ensurePhaseDir(artifactDir, "RECON");
	const outputPath = getArtifactRef(artifactDir, "RECON", "report.md");

	const safeIdea = sanitizeTemplateContent(state.idea).replace(/[\r\n]+/g, " ");

	return Object.freeze({
		action: "dispatch" as const,
		agent: AGENT_NAMES.RECON,
		resultKind: "phase_output",
		prompt: [
			`Research the following idea and write findings to ${outputPath}`,
			`Idea: ${safeIdea}`,
			`Include: Market Analysis, Technology Options, UX Considerations, Feasibility Assessment, Confidence (HIGH/MEDIUM/LOW)`,
		].join("\n"),
		phase: "RECON",
		progress: "Dispatching researcher for domain analysis",
	});
}
