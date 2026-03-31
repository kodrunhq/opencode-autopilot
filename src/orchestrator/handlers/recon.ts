import { ensurePhaseDir, getArtifactRef } from "../artifacts";
import type { PipelineState } from "../types";
import { AGENT_NAMES, type DispatchResult } from "./types";

/**
 * RECON phase handler — dispatches oc-researcher with idea and artifact path.
 * Uses file references (not content injection) per D-11.
 */
export async function handleRecon(
	state: Readonly<PipelineState>,
	artifactDir: string,
	result?: string,
): Promise<DispatchResult> {
	if (result) {
		return Object.freeze({
			action: "complete" as const,
			phase: "RECON",
			progress: "RECON complete",
		});
	}

	const phaseDir = await ensurePhaseDir(artifactDir, "RECON");
	const outputRef = getArtifactRef("RECON", "report.md");

	return Object.freeze({
		action: "dispatch" as const,
		agent: AGENT_NAMES.RECON,
		prompt: [
			`Research the following idea and write findings to ${outputRef}`,
			`Idea: ${state.idea}`,
			`Output: ${phaseDir}/report.md`,
			`Include: Market Analysis, Technology Options, UX Considerations, Feasibility Assessment, Confidence (HIGH/MEDIUM/LOW)`,
		].join("\n"),
		phase: "RECON",
		progress: "Dispatching researcher for domain analysis",
	});
}
