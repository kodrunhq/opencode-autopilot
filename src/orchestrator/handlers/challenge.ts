import { ensurePhaseDir, getArtifactRef } from "../artifacts";
import type { PipelineState } from "../types";
import { AGENT_NAMES, type DispatchResult } from "./types";

/**
 * CHALLENGE phase handler — dispatches oc-challenger with RECON artifact references.
 * References files by path (not content injection) per D-11.
 */
export async function handleChallenge(
	state: Readonly<PipelineState>,
	artifactDir: string,
	result?: string,
): Promise<DispatchResult> {
	if (result) {
		return Object.freeze({
			action: "complete" as const,
			phase: "CHALLENGE",
			progress: "CHALLENGE complete",
		});
	}

	await ensurePhaseDir(artifactDir, "CHALLENGE");
	const reconRef = getArtifactRef("RECON", "report.md");
	const outputRef = getArtifactRef("CHALLENGE", "brief.md");

	return Object.freeze({
		action: "dispatch" as const,
		agent: AGENT_NAMES.CHALLENGE,
		prompt: [
			`Read ${reconRef} for research context.`,
			`Original idea: ${state.idea}`,
			`Propose up to 3 enhancements. Write ambitious brief to ${outputRef}`,
			`For each: name, user value, complexity (LOW/MEDIUM/HIGH), accept/reject rationale.`,
		].join("\n"),
		phase: "CHALLENGE",
		progress: "Dispatching challenger for product enhancements",
	});
}
