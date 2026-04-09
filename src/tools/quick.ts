import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { ensurePhaseDir } from "../orchestrator/artifacts";
import { PHASES, pipelineStateSchema } from "../orchestrator/schemas";
import { loadState, saveState } from "../orchestrator/state";
import { ensureGitignore } from "../utils/gitignore";
import { getProjectArtifactDir, getProjectRootFromArtifactDir } from "../utils/paths";
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
 * Core logic for the /oc-quick command.
 * Creates a pipeline state that starts at PLAN (skipping discovery phases),
 * then delegates to orchestrateCore to continue the pipeline.
 *
 * Note: oc_quick intentionally bypasses intent routing. The /oc-quick command
 * is an explicit user directive to run a simplified pipeline, so intent
 * classification is redundant — the user already chose "quick pipeline".
 */
export async function quickCore(args: QuickArgs, artifactDir: string): Promise<string> {
	// 1. Validate idea
	if (!args.idea || args.idea.trim().length === 0) {
		return JSON.stringify({
			action: "error",
			message: "No idea provided. Usage: /oc-quick <describe the task>",
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
		runId: `quick-${Date.now()}`,
		stateRevision: 0,
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
				rationale: "Quick task mode: user explicitly requested simplified pipeline via /oc-quick",
			},
		],
		confidence: [],
		tasks: [],
		arenaConfidence: null,
		exploreTriggered: false,
		pendingDispatches: [],
		processedResultIds: [],
	});

	// 4. Persist quick state to disk
	await saveState(quickState, artifactDir);

	// 5. Create minimal stub artifacts for skipped phases so the PLAN handler
	//    has something to reference (design.md for ARCHITECT, brief.md for CHALLENGE).
	//    Uses "wx" flag to avoid overwriting existing files.
	const stubs: readonly {
		readonly phase: "ARCHITECT" | "CHALLENGE";
		readonly file: string;
		readonly content: string;
	}[] = [
		{ phase: "ARCHITECT", file: "design.md", content: "# Design\n\n_Skipped in quick mode._\n" },
		{
			phase: "CHALLENGE",
			file: "brief.md",
			content: "# Challenge Brief\n\n_Skipped in quick mode._\n",
		},
	];
	for (const stub of stubs) {
		const phaseDir = await ensurePhaseDir(artifactDir, stub.phase, quickState.runId);
		try {
			await writeFile(join(phaseDir, stub.file), stub.content, { flag: "wx" });
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code !== "EEXIST") {
				throw err;
			}
		}
	}

	// 6. Best-effort .gitignore update (same pattern as orchestrateCore)
	try {
		await ensureGitignore(getProjectRootFromArtifactDir(artifactDir));
	} catch {
		// Non-critical -- swallow gitignore errors
	}

	// 7. Delegate to orchestrateCore to continue from PLAN phase
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
