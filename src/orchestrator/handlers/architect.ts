import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { getLogger } from "../../logging/domains";
import { sanitizeTemplateContent } from "../../review/sanitize";
import { fileExists } from "../../utils/fs-helpers";
import { getProjectRootFromArtifactDir } from "../../utils/paths";
import { getMemoryTunedDepth } from "../arena";
import { ensurePhaseDir, getArtifactRef, getPhaseDir } from "../artifacts";
import { filterByPhase } from "../confidence";
import type { PipelineState } from "../types";
import { AGENT_NAMES, type DispatchResult, type PhaseHandlerContext } from "./types";

const logger = getLogger("orchestrator", "architect");

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
	_context?: PhaseHandlerContext,
): Promise<DispatchResult> {
	const phaseDir = getPhaseDir(artifactDir, "ARCHITECT", state.runId);
	const critiqueExists = await fileExists(join(phaseDir, "critique.md"));
	const designExists = await fileExists(join(phaseDir, "design.md"));

	// Result-envelope validation: when agent returns, verify expected artifact exists
	if (result) {
		// Step 3: critique or design exists -> complete
		if (critiqueExists || designExists) {
			return Object.freeze({
				action: "complete" as const,
				phase: "ARCHITECT",
				progress: "ARCHITECT complete",
			});
		}

		// Determine expected proposal count for arena mode
		await ensurePhaseDir(artifactDir, "ARCHITECT", state.runId);
		const reconEntries = filterByPhase(state.confidence, "RECON");
		const depth = getMemoryTunedDepth(reconEntries, getProjectRootFromArtifactDir(artifactDir));
		const proposalsDir = join(phaseDir, "proposals");

		if (depth > 1) {
			// Arena mode: expect proposals directory with >= depth files
			const proposalCount = await countProposalFiles(proposalsDir);
			if (proposalCount < depth) {
				const artifactPath = join(proposalsDir, `proposal-*.md`);
				logger.warn("ARCHITECT result received but proposals incomplete", {
					operation: "phase_transition",
					phase: "ARCHITECT",
					artifactPath,
					expected: depth,
					actual: proposalCount,
				});
				return Object.freeze({
					action: "error" as const,
					phase: "ARCHITECT",
					message: `ARCHITECT agent returned a result but did not write all required proposals: expected ${depth} proposals in ${proposalsDir}, found ${proposalCount}. The agent must write all proposal files before the phase can complete.`,
				});
			}
			// Proposals complete, dispatch critic
			return Object.freeze({
				action: "dispatch" as const,
				agent: AGENT_NAMES.CRITIC,
				resultKind: "phase_output",
				prompt: buildCriticPrompt(artifactDir, proposalsDir, state),
				phase: "ARCHITECT",
				progress: "Dispatching critic for proposal review",
			});
		} else {
			// Single mode: expect design.md
			const artifactPath = getArtifactRef(artifactDir, "ARCHITECT", "design.md", state.runId);
			logger.warn("ARCHITECT result received but artifact not found", {
				operation: "phase_transition",
				phase: "ARCHITECT",
				artifactPath,
			});
			return Object.freeze({
				action: "error" as const,
				phase: "ARCHITECT",
				message: `ARCHITECT agent returned a result but did not write the required artifact: ${artifactPath}. The agent must write design.md before the phase can complete.`,
			});
		}
	}

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

	// Determine expected proposal count BEFORE checking existence
	// so we can verify ALL proposals were written, not just one
	await ensurePhaseDir(artifactDir, "ARCHITECT", state.runId);
	const reconEntries = filterByPhase(state.confidence, "RECON");
	const depth = getMemoryTunedDepth(reconEntries, getProjectRootFromArtifactDir(artifactDir));

	if (depth > 1) {
		const proposalCount = await countProposalFiles(proposalsDir);
		if (proposalCount > 0) {
			if (proposalCount < depth) {
				return Object.freeze({
					action: "error" as const,
					phase: "ARCHITECT",
					message: `ARCHITECT arena: expected ${depth} proposals but only ${proposalCount} were written in ${proposalsDir}. Missing proposals must be written before critic can evaluate.`,
				});
			}
			return Object.freeze({
				action: "dispatch" as const,
				agent: AGENT_NAMES.CRITIC,
				resultKind: "phase_output",
				prompt: buildCriticPrompt(artifactDir, proposalsDir, state),
				phase: "ARCHITECT",
				progress: "Dispatching critic for proposal review",
			});
		}
	} else {
		// depth === 1: single architect, no arena — check for any proposals for resume
		const hasProposals = await hasProposalFiles(proposalsDir);
		if (hasProposals) {
			return Object.freeze({
				action: "dispatch" as const,
				agent: AGENT_NAMES.CRITIC,
				resultKind: "phase_output",
				prompt: buildCriticPrompt(artifactDir, proposalsDir, state),
				phase: "ARCHITECT",
				progress: "Dispatching critic for proposal review",
			});
		}
	}

	// Step 1: Dispatch architect(s) based on confidence depth
	const reconRef = getArtifactRef(artifactDir, "RECON", "report.md", state.runId);
	const challengeRef = getArtifactRef(artifactDir, "CHALLENGE", "brief.md", state.runId);
	const safeIdea = sanitizeTemplateContent(state.idea).replace(/[\r\n]+/g, " ");

	if (depth === 1) {
		return Object.freeze({
			action: "dispatch" as const,
			agent: AGENT_NAMES.ARCHITECT,
			resultKind: "phase_output",
			prompt: [
				`Read ${reconRef} and ${challengeRef} for context.`,
				"",
				`Design architecture for: ${safeIdea}`,
				"",
				`Write design to ${getArtifactRef(artifactDir, "ARCHITECT", "design.md", state.runId)}`,
				"",
				"Your design document MUST contain these sections:",
				"",
				"## Component Architecture",
				"- Named components with single-responsibility descriptions",
				"- Component boundaries: what each owns, what it delegates",
				"- Dependency direction (which components know about which)",
				"",
				"## Data Flow",
				"- Primary data paths through the system (input → processing → output)",
				"- State management strategy (where state lives, how it's synchronized)",
				"- External data sources and sinks",
				"",
				"## API Contracts",
				"- Public interfaces between components (function signatures, message formats)",
				"- Error handling strategy: how errors propagate across boundaries",
				"- Validation points (where input is validated and by what rules)",
				"",
				"## Technology Choices",
				"- Selected libraries/frameworks with version constraints",
				"- Why each was chosen over alternatives (one sentence each)",
				"",
				"## Risk Mitigation",
				"- Top 3 technical risks with concrete mitigation strategies",
				"- Performance bottlenecks and how they're addressed",
				"",
				"## Confidence",
				"Rate: HIGH / MEDIUM / LOW with justification referencing specific sections.",
			].join("\n"),
			phase: "ARCHITECT",
			progress: "Dispatching architect for design",
		});
	}

	const agents = CONSTRAINT_FRAMINGS.slice(0, depth).map((constraint, i) => {
		const label = String.fromCharCode(65 + i); // A, B, C
		return Object.freeze({
			agent: AGENT_NAMES.ARCHITECT,
			resultKind: "phase_output" as const,
			prompt: [
				`Read ${reconRef} and ${challengeRef} for context.`,
				"",
				`Design architecture for: ${safeIdea}`,
				`Design constraint: ${constraint}`,
				"",
				`Write proposal to ${join(proposalsDir, `proposal-${label}.md`)}`,
				"",
				"Your proposal MUST contain these sections:",
				"",
				"## Component Architecture",
				"- Named components with single-responsibility descriptions",
				"- Component boundaries and dependency direction",
				"- How the design constraint shapes component decomposition",
				"",
				"## Data Flow",
				"- Primary data paths (input → processing → output)",
				"- State management strategy",
				"",
				"## API Contracts",
				"- Public interfaces between components",
				"- Error handling and validation strategy",
				"",
				"## Technology Choices",
				"- Selected libraries/frameworks with justification",
				"- How choices align with the design constraint",
				"",
				"## Tradeoffs",
				"- What this design optimizes for (per the constraint)",
				"- What it sacrifices and why that's acceptable",
				"",
				"## Confidence",
				"Rate: HIGH / MEDIUM / LOW with justification.",
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

function buildCriticPrompt(
	artifactDir: string,
	proposalsDir: string,
	state: Readonly<PipelineState>,
): string {
	return [
		`Review architecture proposals in ${proposalsDir}/`,
		`Read ${getArtifactRef(artifactDir, "RECON", "report.md", state.runId)} and ${getArtifactRef(artifactDir, "CHALLENGE", "brief.md", state.runId)} for context.`,
		"",
		`Write a comparative critique to ${getArtifactRef(artifactDir, "ARCHITECT", "critique.md", state.runId)}`,
		"",
		"Your critique MUST contain:",
		"",
		"## Per-Proposal Analysis",
		"For each proposal:",
		"- **Strengths**: What does this design get right? (be specific, reference sections)",
		"- **Weaknesses**: What are the gaps or risks? (be specific, cite affected components)",
		"- **Feasibility**: Can this be built with the identified stack and timeline?",
		"- **Testability**: How easily can this design be validated and tested?",
		"",
		"## Comparative Matrix",
		"| Criterion | Proposal A | Proposal B | ... |",
		"| --- | --- | --- | --- |",
		"| Simplicity | ... | ... | ... |",
		"| Extensibility | ... | ... | ... |",
		"| Performance | ... | ... | ... |",
		"| Risk | ... | ... | ... |",
		"",
		"## Recommendation",
		"- Which proposal to adopt (or which elements to combine)",
		"- Key modifications needed before proceeding",
		"- Confidence: HIGH / MEDIUM / LOW (with justification)",
	].join("\n");
}

async function hasProposalFiles(proposalsDir: string): Promise<boolean> {
	try {
		const entries = await readdir(proposalsDir);
		return entries.some((e) => e.startsWith("proposal-") && e.endsWith(".md"));
	} catch {
		return false;
	}
}

async function countProposalFiles(proposalsDir: string): Promise<number> {
	try {
		const entries = await readdir(proposalsDir);
		return entries.filter((e) => e.startsWith("proposal-") && e.endsWith(".md")).length;
	} catch {
		return 0;
	}
}
