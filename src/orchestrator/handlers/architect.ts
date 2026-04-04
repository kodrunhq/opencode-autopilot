import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sanitizeTemplateContent } from "../../review/sanitize";
import { fileExists } from "../../utils/fs-helpers";
import { getMemoryTunedDepth } from "../arena";
import { ensurePhaseDir, getArtifactRef, getPhaseDir } from "../artifacts";
import { filterByPhase } from "../confidence";
import type { PipelineState } from "../types";
import { AGENT_NAMES, type DispatchResult } from "./types";

const CONSTRAINT_FRAMINGS: readonly string[] = Object.freeze([
	"Optimize for simplicity and minimal dependencies",
	"Optimize for extensibility and future growth",
	"Optimize for performance and resource efficiency",
]);

/**
 * ARCHITECT phase handler with Arena multi-proposal logic.
 *
 * Three-step flow using artifact-existence for idempotency:
 * 1. No proposals/design -> dispatch architect(s) based on debate depth
 * 2. Proposals exist but no critique -> dispatch critic
 * 3. Critique or design exists -> complete
 */
export async function handleArchitect(
	state: Readonly<PipelineState>,
	artifactDir: string,
	result?: string,
): Promise<DispatchResult> {
	// Complete when agent returns a result (matching RECON/CHALLENGE/PLAN/SHIP pattern)
	if (result) {
		return Object.freeze({
			action: "complete" as const,
			phase: "ARCHITECT",
			progress: "ARCHITECT complete",
		});
	}

	const phaseDir = getPhaseDir(artifactDir, "ARCHITECT");
	const critiqueExists = await fileExists(join(phaseDir, "critique.md"));
	const designExists = await fileExists(join(phaseDir, "design.md"));

	// Step 3: critique or design exists -> complete (idempotency on resume)
	if (critiqueExists || designExists) {
		return Object.freeze({
			action: "complete" as const,
			phase: "ARCHITECT",
			progress: "ARCHITECT complete",
		});
	}

	// Check for existing proposals (Step 2)
	const proposalsDir = join(phaseDir, "proposals");
	const hasProposals = await hasProposalFiles(proposalsDir);

	if (hasProposals) {
		return Object.freeze({
			action: "dispatch" as const,
			agent: AGENT_NAMES.CRITIC,
			prompt: [
				`Review architecture proposals in ${proposalsDir}/`,
				`Read ${getArtifactRef(artifactDir, "RECON", "report.md")} and ${getArtifactRef(artifactDir, "CHALLENGE", "brief.md")} for context.`,
				`Write comparative critique to ${getArtifactRef(artifactDir, "ARCHITECT", "critique.md")}`,
				`Include: strengths, weaknesses, recommendation, confidence (HIGH/MEDIUM/LOW).`,
			].join("\n"),
			phase: "ARCHITECT",
			progress: "Dispatching critic for proposal review",
		});
	}

	// Step 1: Dispatch architect(s) based on confidence depth
	await ensurePhaseDir(artifactDir, "ARCHITECT");
	const reconEntries = filterByPhase(state.confidence, "RECON");
	const depth = getMemoryTunedDepth(reconEntries, join(artifactDir, ".."));
	const reconRef = getArtifactRef(artifactDir, "RECON", "report.md");
	const challengeRef = getArtifactRef(artifactDir, "CHALLENGE", "brief.md");
	const safeIdea = sanitizeTemplateContent(state.idea).replace(/[\r\n]+/g, " ");

	if (depth === 1) {
		return Object.freeze({
			action: "dispatch" as const,
			agent: AGENT_NAMES.ARCHITECT,
			prompt: [
				`Read ${reconRef} and ${challengeRef} for context.`,
				`Design architecture for: ${safeIdea}`,
				`Write design to ${getArtifactRef(artifactDir, "ARCHITECT", "design.md")}`,
				`Include: component diagram, data flow, technology choices, confidence (HIGH/MEDIUM/LOW).`,
			].join("\n"),
			phase: "ARCHITECT",
			progress: "Dispatching architect for design",
		});
	}

	const agents = CONSTRAINT_FRAMINGS.slice(0, depth).map((constraint, i) => {
		const label = String.fromCharCode(65 + i); // A, B, C
		return Object.freeze({
			agent: AGENT_NAMES.ARCHITECT,
			prompt: [
				`Read ${reconRef} and ${challengeRef} for context.`,
				`Design architecture for: ${safeIdea}`,
				`Constraint: ${constraint}`,
				`Write proposal to ${join(proposalsDir, `proposal-${label}.md`)}`,
				`Include: component diagram, data flow, technology choices, confidence (HIGH/MEDIUM/LOW).`,
			].join("\n"),
		});
	});

	return Object.freeze({
		action: "dispatch_multi" as const,
		agents: Object.freeze(agents),
		phase: "ARCHITECT",
		progress: `Dispatching ${depth} architects for Arena proposals`,
	});
}

async function hasProposalFiles(proposalsDir: string): Promise<boolean> {
	try {
		const entries = await readdir(proposalsDir);
		return entries.some((e) => e.startsWith("proposal-") && e.endsWith(".md"));
	} catch {
		return false;
	}
}
