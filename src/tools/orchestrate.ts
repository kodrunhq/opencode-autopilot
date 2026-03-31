import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { completePhase, getNextPhase } from "../orchestrator/phase";
import { createInitialState, loadState, saveState } from "../orchestrator/state";
import type { Phase } from "../orchestrator/types";
import { ensureGitignore } from "../utils/gitignore";

const PHASE_AGENTS: Readonly<Record<Phase, string>> = Object.freeze({
	RECON: "oc-researcher",
	CHALLENGE: "oc-challenger",
	ARCHITECT: "oc-architect",
	EXPLORE: "oc-explorer",
	PLAN: "oc-planner",
	BUILD: "oc-builder",
	SHIP: "oc-shipper",
	RETROSPECTIVE: "oc-retrospector",
});

interface OrchestrateArgs {
	readonly idea?: string;
	readonly result?: string;
}

export async function orchestrateCore(args: OrchestrateArgs, artifactDir: string): Promise<string> {
	try {
		const state = await loadState(artifactDir);

		// No state and no idea -> error
		if (state === null && !args.idea) {
			return JSON.stringify({
				action: "error",
				message: "No active run. Provide an idea to start.",
			});
		}

		// No state but idea provided -> create initial state and dispatch RECON
		if (state === null && args.idea) {
			const newState = createInitialState(args.idea);
			await saveState(newState, artifactDir);

			// Best-effort .gitignore update (don't fail the dispatch if this errors)
			try {
				const projectRoot = join(artifactDir, "..");
				await ensureGitignore(projectRoot);
			} catch {
				// Swallow gitignore errors -- non-critical
			}

			const agent = PHASE_AGENTS[newState.currentPhase as Phase];
			return JSON.stringify({
				action: "dispatch",
				agent,
				prompt: `Research: ${args.idea}`,
				phase: newState.currentPhase,
				progress: "Starting new orchestration run",
			});
		}

		// State exists
		if (state !== null) {
			// If result provided -> complete current phase and advance
			if (args.result) {
				const currentPhase = state.currentPhase;

				if (currentPhase === null) {
					return JSON.stringify({
						action: "complete",
						summary: `Pipeline completed. Idea: ${state.idea}`,
					});
				}

				// Check if this is the terminal phase
				const nextPhase = getNextPhase(currentPhase);
				if (nextPhase === null) {
					// Complete the terminal phase
					const updated = completePhase(state);
					const finishedState = { ...updated, status: "COMPLETED" as const };
					await saveState(finishedState, artifactDir);
					return JSON.stringify({
						action: "complete",
						summary: `Pipeline completed all 8 phases. Idea: ${state.idea}`,
					});
				}

				// Complete current phase and dispatch next
				const updated = completePhase(state);
				await saveState(updated, artifactDir);

				const agent = PHASE_AGENTS[nextPhase];
				return JSON.stringify({
					action: "dispatch",
					agent,
					prompt: `${nextPhase}: Continue pipeline for "${state.idea}". Previous phase result: ${args.result}`,
					phase: nextPhase,
					progress: `Advancing from ${currentPhase} to ${nextPhase}`,
				});
			}

			// State exists but no result -- return current status
			if (state.currentPhase === null) {
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline already completed. Idea: ${state.idea}`,
				});
			}

			const agent = PHASE_AGENTS[state.currentPhase];
			return JSON.stringify({
				action: "dispatch",
				agent,
				prompt: `Continue ${state.currentPhase} phase for "${state.idea}"`,
				phase: state.currentPhase,
				progress: `Resuming at ${state.currentPhase}`,
			});
		}

		return JSON.stringify({ action: "error", message: "Unexpected state" });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return JSON.stringify({ action: "error", message });
	}
}

export const ocOrchestrate = tool({
	description:
		"Drive the orchestrator pipeline. Provide an idea to start a new run, or a result to advance the current phase. Returns JSON with action (dispatch/complete/error).",
	args: {
		idea: tool.schema.string().optional().describe("Idea to start a new orchestration run"),
		result: tool.schema
			.string()
			.optional()
			.describe("Result from previous agent to advance the pipeline"),
	},
	async execute(args) {
		return orchestrateCore(args, join(process.cwd(), ".opencode-assets"));
	},
});
