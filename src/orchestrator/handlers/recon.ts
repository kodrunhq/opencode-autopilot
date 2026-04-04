import { sanitizeTemplateContent } from "../../review/sanitize";
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
		// Warn if artifact wasn't written (best-effort — still complete the phase)
		const artifactPath = getArtifactRef(artifactDir, "RECON", "report.md");
		try {
			const { existsSync } = await import("node:fs");
			if (!existsSync(artifactPath)) {
				console.warn(`[opencode-autopilot] RECON completed but ${artifactPath} not found`);
			}
		} catch {
			/* best-effort */
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
		prompt: [
			`Research the following idea and write findings to ${outputPath}`,
			`Idea: ${safeIdea}`,
			`Include: Market Analysis, Technology Options, UX Considerations, Feasibility Assessment, Confidence (HIGH/MEDIUM/LOW)`,
		].join("\n"),
		phase: "RECON",
		progress: "Dispatching researcher for domain analysis",
	});
}
