import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { PHASES, pipelineStateSchema } from "../orchestrator/schemas";
import { loadState, saveState } from "../orchestrator/state";
import { ensureGitignore } from "../utils/gitignore";
import { getProjectArtifactDir } from "../utils/paths";
import { orchestrateCore } from "./orchestrate";

/** Phases skipped in quick mode (per D-17: skip RECON, CHALLENGE, ARCHITECT, EXPLORE). */
const QUICK_SKIP_PHASES: ReadonlySet<string> = new Set([
	"RECON",
	"CHALLENGE",
	"ARCHITECT",
	"EXPLORE",
] as const);

interface QuickArgs {
	readonly idea: string;
}

/**
 * Core logic for the /quick command.
 * Creates a pipeline state that starts at PLAN (skipping discovery phases),
 * then delegates to orchestrateCore to continue the pipeline.
 */
export async function quickCore(args: QuickArgs, artifactDir: string): Promise<string> {
	// 1. Validate idea
	if (!args.idea || args.idea.trim().length === 0) {
		return JSON.stringify({
			action: "error",
			message: "No idea provided. Usage: /quick <describe the task>",
		});
	}

	// 2. Check for existing in-progress run
	const existing = await loadState(artifactDir);
	if (existing !== null && existing.status === "IN_PROGRESS") {
		return JSON.stringify({
			action: "error",
			message:
				"An orchestration run is already in progress. Complete or reset it before starting a quick task.",
		});
	}

	// 3. Create quick-mode initial state (starts at PLAN, skips discovery phases)
	const now = new Date().toISOString();
	const quickState = pipelineStateSchema.parse({
		schemaVersion: 2,
		status: "IN_PROGRESS",
		idea: args.idea,
		currentPhase: "PLAN",
		startedAt: now,
		lastUpdatedAt: now,
		phases: PHASES.map((name) => ({
			name,
			status: QUICK_SKIP_PHASES.has(name) ? "SKIPPED" : name === "PLAN" ? "IN_PROGRESS" : "PENDING",
			...(QUICK_SKIP_PHASES.has(name) ? { completedAt: now } : {}),
		})),
		decisions: [
			{
				timestamp: now,
				phase: "PLAN",
				agent: "oc-quick",
				decision: "Skip discovery phases",
				rationale: "Quick task mode: user explicitly requested simplified pipeline via /quick",
			},
		],
		confidence: [],
		tasks: [],
		arenaConfidence: null,
		exploreTriggered: false,
	});

	// 4. Persist quick state to disk
	await saveState(quickState, artifactDir);

	// 5. Best-effort .gitignore update (same pattern as orchestrateCore)
	try {
		await ensureGitignore(join(artifactDir, ".."));
	} catch {
		// Non-critical -- swallow gitignore errors
	}

	// 6. Delegate to orchestrateCore to continue from PLAN phase
	return orchestrateCore({ result: undefined }, artifactDir);
}

export const ocQuick = tool({
	description:
		"Run a quick task through a simplified pipeline. Skips research and architecture phases (RECON, CHALLENGE, ARCHITECT, EXPLORE) and goes straight to PLAN -> BUILD -> SHIP -> RETROSPECTIVE. Use for small, well-understood tasks.",
	args: {
		idea: tool.schema.string().min(1).max(4096).describe("The task to accomplish"),
	},
	async execute(args) {
		return quickCore(args, getProjectArtifactDir(process.cwd()));
	},
});
