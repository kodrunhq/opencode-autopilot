import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { PHASE_HANDLERS } from "../orchestrator/handlers/index";
import type { DispatchResult } from "../orchestrator/handlers/types";
import { buildLessonContext } from "../orchestrator/lesson-injection";
import { loadLessonMemory } from "../orchestrator/lesson-memory";
import { completePhase, getNextPhase } from "../orchestrator/phase";
import { createInitialState, loadState, patchState, saveState } from "../orchestrator/state";
import type { Phase } from "../orchestrator/types";
import { ensureGitignore } from "../utils/gitignore";
import { getProjectArtifactDir } from "../utils/paths";
import { reviewCore } from "./review";

interface OrchestrateArgs {
	readonly idea?: string;
	readonly result?: string;
}

/**
 * Apply state updates from a DispatchResult if present, then save.
 * Returns the updated state.
 */
async function applyStateUpdates(
	state: Readonly<import("../orchestrator/types").PipelineState>,
	handlerResult: DispatchResult,
	artifactDir: string,
): Promise<import("../orchestrator/types").PipelineState> {
	const updates = handlerResult._stateUpdates;
	if (updates) {
		const updated = patchState(state, updates);
		await saveState(updated, artifactDir);
		return updated;
	}
	return state;
}

/**
 * When a handler dispatches "oc-reviewer", call reviewCore directly instead
 * of returning the dispatch instruction. This avoids the JSON round-trip
 * for the review integration in BUILD phase (per CONTEXT.md).
 */
async function maybeInlineReview(
	handlerResult: DispatchResult,
	artifactDir: string,
): Promise<{ readonly inlined: boolean; readonly reviewResult?: string }> {
	if (
		handlerResult.action === "dispatch" &&
		handlerResult.agent === "oc-reviewer" &&
		handlerResult.prompt
	) {
		const projectRoot = join(artifactDir, "..");
		const reviewResult = await reviewCore({ scope: "branch" }, projectRoot);
		return { inlined: true, reviewResult };
	}
	return { inlined: false };
}

/**
 * Attempt to inject lesson context into a dispatch prompt.
 * Best-effort: failures are silently swallowed to avoid breaking dispatch.
 */
async function injectLessonContext(
	prompt: string,
	phase: string,
	artifactDir: string,
): Promise<string> {
	try {
		const projectRoot = join(artifactDir, "..");
		const memory = await loadLessonMemory(projectRoot);
		if (memory && memory.lessons.length > 0) {
			const ctx = buildLessonContext(memory.lessons, phase as Phase);
			if (ctx) {
				return prompt + ctx;
			}
		}
	} catch {
		// Best-effort: lesson injection failure should not break dispatch
	}
	return prompt;
}

/**
 * Process a handler's DispatchResult, handling complete/dispatch/dispatch_multi/error.
 * On complete, advances the phase and invokes the next handler.
 */
async function processHandlerResult(
	handlerResult: DispatchResult,
	state: Readonly<import("../orchestrator/types").PipelineState>,
	artifactDir: string,
): Promise<string> {
	// Apply state updates from handler if present
	const currentState = await applyStateUpdates(state, handlerResult, artifactDir);

	switch (handlerResult.action) {
		case "error":
			return JSON.stringify(handlerResult);

		case "dispatch": {
			// Check if this is a review dispatch that should be inlined
			const { inlined, reviewResult } = await maybeInlineReview(handlerResult, artifactDir);
			if (inlined && reviewResult) {
				// Feed the review result back into the current phase handler
				const reloadedState = await loadState(artifactDir);
				if (reloadedState?.currentPhase) {
					const handler = PHASE_HANDLERS[reloadedState.currentPhase];
					const nextResult = await handler(reloadedState, artifactDir, reviewResult);
					return processHandlerResult(nextResult, reloadedState, artifactDir);
				}
			}
			// Inject lesson context into dispatch prompt (best-effort)
			if (handlerResult.prompt && handlerResult.phase) {
				const enrichedPrompt = await injectLessonContext(
					handlerResult.prompt,
					handlerResult.phase,
					artifactDir,
				);
				if (enrichedPrompt !== handlerResult.prompt) {
					return JSON.stringify({ ...handlerResult, prompt: enrichedPrompt });
				}
			}
			return JSON.stringify(handlerResult);
		}

		case "dispatch_multi": {
			// Inject lesson context into each agent's prompt (best-effort)
			if (handlerResult.agents && handlerResult.phase) {
				const enrichedAgents = await Promise.all(
					handlerResult.agents.map(async (entry) => {
						const enrichedPrompt = await injectLessonContext(
							entry.prompt,
							handlerResult.phase as string,
							artifactDir,
						);
						return enrichedPrompt !== entry.prompt ? { ...entry, prompt: enrichedPrompt } : entry;
					}),
				);
				return JSON.stringify({ ...handlerResult, agents: enrichedAgents });
			}
			return JSON.stringify(handlerResult);
		}

		case "complete": {
			if (currentState.currentPhase === null) {
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline completed. Idea: ${currentState.idea}`,
				});
			}

			const nextPhase = getNextPhase(currentState.currentPhase);
			const advanced = completePhase(currentState);
			await saveState(advanced, artifactDir);

			if (nextPhase === null) {
				// Terminal phase completed
				const finished = { ...advanced, status: "COMPLETED" as const };
				await saveState(finished, artifactDir);
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline completed all 8 phases. Idea: ${currentState.idea}`,
				});
			}

			// Invoke the next phase handler immediately
			const nextHandler = PHASE_HANDLERS[nextPhase];
			const nextResult = await nextHandler(advanced, artifactDir);
			return processHandlerResult(nextResult, advanced, artifactDir);
		}

		default:
			return JSON.stringify({ action: "error", message: "Unknown handler action" });
	}
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

		// No state but idea provided -> create initial state and dispatch RECON via handler
		if (state === null && args.idea) {
			const newState = createInitialState(args.idea);
			await saveState(newState, artifactDir);

			// Best-effort .gitignore update
			try {
				const projectRoot = join(artifactDir, "..");
				await ensureGitignore(projectRoot);
			} catch {
				// Swallow gitignore errors -- non-critical
			}

			const handler = PHASE_HANDLERS[newState.currentPhase as Phase];
			const handlerResult = await handler(newState, artifactDir);
			return processHandlerResult(handlerResult, newState, artifactDir);
		}

		// State exists
		if (state !== null) {
			// Pipeline already completed
			if (state.currentPhase === null) {
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline already completed. Idea: ${state.idea}`,
				});
			}

			// Delegate to current phase handler
			const handler = PHASE_HANDLERS[state.currentPhase];
			const handlerResult = await handler(state, artifactDir, args.result);
			return processHandlerResult(handlerResult, state, artifactDir);
		}

		return JSON.stringify({ action: "error", message: "Unexpected state" });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);

		// Persist failure metadata for forensics (best-effort)
		try {
			const currentState = await loadState(artifactDir);
			if (currentState?.currentPhase) {
				const lastDone = currentState.phases.filter((p) => p.status === "DONE").pop();
				const failureContext = {
					failedPhase: currentState.currentPhase,
					failedAgent: null as string | null,
					errorMessage: message.slice(0, 4096),
					timestamp: new Date().toISOString(),
					lastSuccessfulPhase: lastDone?.name ?? null,
				};
				const failed = patchState(currentState, {
					status: "FAILED" as const,
					failureContext,
				});
				await saveState(failed, artifactDir);
			}
		} catch {
			// Swallow save errors -- original error takes priority
		}

		return JSON.stringify({ action: "error", message });
	}
}

export const ocOrchestrate = tool({
	description:
		"Drive the orchestrator pipeline. Provide an idea to start a new run, or a result to advance the current phase. Returns JSON with action (dispatch/dispatch_multi/complete/error).",
	args: {
		idea: tool.schema.string().optional().describe("Idea to start a new orchestration run"),
		result: tool.schema
			.string()
			.optional()
			.describe("Result from previous agent to advance the pipeline"),
	},
	async execute(args) {
		return orchestrateCore(args, getProjectArtifactDir(process.cwd()));
	},
});
