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
		const artifactPath = getArtifactRef(artifactDir, "RECON", "report.md", state.runId);
		if (!(await fileExists(artifactPath))) {
			logger.warn("RECON result received but artifact not found", {
				operation: "phase_transition",
				phase: "RECON",
				artifactPath,
			});
			return Object.freeze({
				action: "error" as const,
				phase: "RECON",
				message: `RECON agent returned a result but did not write the required artifact: ${artifactPath}. The agent must write report.md before the phase can complete.`,
				errorSeverity: "recoverable" as const,
			});
		}
		return Object.freeze({
			action: "complete" as const,
			phase: "RECON",
			progress: "RECON complete",
		});
	}

	await ensurePhaseDir(artifactDir, "RECON", state.runId);
	const outputPath = getArtifactRef(artifactDir, "RECON", "report.md", state.runId);

	const safeIdea = sanitizeTemplateContent(state.idea).replace(/[\r\n]+/g, " ");

	return Object.freeze({
		action: "dispatch" as const,
		agent: AGENT_NAMES.RECON,
		resultKind: "phase_output",
		prompt: [
			`Research the following idea and write a structured report to ${outputPath}`,
			"",
			`Idea: ${safeIdea}`,
			"",
			"Your report MUST contain these sections in order:",
			"",
			"## Market Analysis",
			"- Existing solutions and competitors (name specific products/projects)",
			"- Target audience and use-case fit",
			"- Gaps in the current landscape this idea addresses",
			"",
			"## Technology Options",
			"- Recommended stack with justification (why X over Y)",
			"- Key libraries/frameworks with version constraints if relevant",
			"- Infrastructure requirements (runtime, storage, external services)",
			"",
			"## UX Considerations",
			"- Primary user workflows affected",
			"- Complexity budget — what must be simple vs. what can be advanced",
			"- Accessibility and performance constraints",
			"",
			"## Feasibility Assessment",
			"- Implementation complexity: LOW / MEDIUM / HIGH (with reasoning)",
			"- Key risks and unknowns (list each with mitigation strategy)",
			"- Dependencies on external systems or APIs",
			"- Estimated scope: small (hours), medium (days), large (weeks)",
			"",
			"## Confidence",
			"Rate overall confidence: HIGH / MEDIUM / LOW",
			"Justify the rating by referencing specific findings above.",
			"",
			"Keep the report factual and specific — avoid vague statements.",
			"Cite sources or reference existing projects when possible.",
		].join("\n"),
		phase: "RECON",
		progress: "Dispatching researcher for domain analysis",
	});
}
