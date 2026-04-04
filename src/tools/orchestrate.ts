import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { PHASE_HANDLERS } from "../orchestrator/handlers/index";
import type { DispatchResult } from "../orchestrator/handlers/types";
import { buildLessonContext } from "../orchestrator/lesson-injection";
import { loadLessonMemory } from "../orchestrator/lesson-memory";
import { logOrchestrationEvent } from "../orchestrator/orchestration-logger";
import { completePhase, getNextPhase, PHASE_INDEX, TOTAL_PHASES } from "../orchestrator/phase";
import { loadAdaptiveSkillContext } from "../orchestrator/skill-injection";
import { createInitialState, loadState, patchState, saveState } from "../orchestrator/state";
import type { Phase, PipelineState } from "../orchestrator/types";
import { isEnoentError } from "../utils/fs-helpers";
import { ensureGitignore } from "../utils/gitignore";
import { getGlobalConfigDir, getProjectArtifactDir } from "../utils/paths";
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
	state: Readonly<PipelineState>,
	handlerResult: DispatchResult,
	artifactDir: string,
): Promise<PipelineState> {
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
	} catch (error: unknown) {
		if (
			isEnoentError(error) ||
			error instanceof SyntaxError ||
			(error !== null && typeof error === "object" && "issues" in error)
		) {
			return prompt; // I/O, parse, or validation error -- non-critical
		}
		// Treat any NodeJS.ErrnoException (EACCES, EPERM, etc.) as non-critical
		if (error !== null && typeof error === "object") {
			const errWithCode = error as { code?: unknown };
			if (typeof errWithCode.code === "string") {
				return prompt;
			}
		}
		throw error; // re-throw programmer errors
	}
	return prompt;
}

/**
 * Attempt to inject stack-filtered adaptive skill context into a dispatch prompt.
 * Best-effort: failures are silently swallowed to avoid breaking dispatch.
 */
async function injectSkillContext(
	prompt: string,
	projectRoot?: string,
	phase?: string,
): Promise<string> {
	try {
		const baseDir = getGlobalConfigDir();
		const ctx = await loadAdaptiveSkillContext(baseDir, projectRoot ?? process.cwd(), {
			phase,
			budget: 1500,
			mode: "summary",
		});
		if (ctx) return prompt + ctx;
	} catch (err) {
		console.warn("[opencode-autopilot] skill injection failed:", err);
	}
	return prompt;
}

/** Build a human-readable progress string for user-facing display. */
function buildUserProgress(phase: string, label?: string, attempt?: number): string {
	const idx = PHASE_INDEX[phase] ?? 0;
	const desc = label ?? "dispatching";
	const att = attempt != null ? ` (attempt ${attempt})` : "";
	return `Phase ${idx}/${TOTAL_PHASES}: ${phase} — ${desc}${att}`;
}

/** Per-phase dispatch limits. BUILD is high because of multi-task waves. */
const MAX_PHASE_DISPATCHES: Readonly<Record<string, number>> = Object.freeze({
	RECON: 3,
	CHALLENGE: 3,
	ARCHITECT: 10,
	EXPLORE: 3,
	PLAN: 5,
	BUILD: 100,
	SHIP: 5,
	RETROSPECTIVE: 3,
});

/**
 * Circuit breaker: increment per-phase dispatch count and abort if limit exceeded.
 * Returns `{ abortMsg, newCount }`. When `abortMsg` is non-null the caller must
 * return it immediately. `newCount` is the authoritative post-increment value.
 */
async function checkCircuitBreaker(
	currentState: Readonly<PipelineState>,
	phase: string,
	artifactDir: string,
): Promise<{ readonly abortMsg: string | null; readonly newCount: number }> {
	const counts = { ...(currentState.phaseDispatchCounts ?? {}) };
	counts[phase] = (counts[phase] ?? 0) + 1;
	const newCount = counts[phase];
	const limit = MAX_PHASE_DISPATCHES[phase] ?? 5;
	if (newCount > limit) {
		const msg = `Phase ${phase} exceeded max dispatches (${newCount}/${limit}) — possible infinite loop detected. Aborting.`;
		logOrchestrationEvent(artifactDir, {
			timestamp: new Date().toISOString(),
			phase,
			action: "loop_detected",
			attempt: newCount,
			message: msg,
		});
		return { abortMsg: JSON.stringify({ action: "error", message: msg }), newCount };
	}
	const withCounts = patchState(currentState, { phaseDispatchCounts: counts });
	await saveState(withCounts, artifactDir);
	return { abortMsg: null, newCount };
}

/**
 * Process a handler's DispatchResult, handling complete/dispatch/dispatch_multi/error.
 * On complete, advances the phase and invokes the next handler.
 */
async function processHandlerResult(
	handlerResult: DispatchResult,
	state: Readonly<PipelineState>,
	artifactDir: string,
): Promise<string> {
	// Apply state updates from handler if present
	const currentState = await applyStateUpdates(state, handlerResult, artifactDir);

	switch (handlerResult.action) {
		case "error":
			logOrchestrationEvent(artifactDir, {
				timestamp: new Date().toISOString(),
				phase: handlerResult.phase ?? currentState.currentPhase ?? "UNKNOWN",
				action: "error",
				message: handlerResult.message?.slice(0, 500),
			});
			return JSON.stringify(handlerResult);

		case "dispatch": {
			// Circuit breaker
			const phase = handlerResult.phase ?? currentState.currentPhase ?? "UNKNOWN";
			const { abortMsg, newCount: attempt } = await checkCircuitBreaker(
				currentState,
				phase,
				artifactDir,
			);
			if (abortMsg) return abortMsg;

			// Log the dispatch event before any inline-review or context injection
			const progress = buildUserProgress(phase, handlerResult.progress, attempt);
			logOrchestrationEvent(artifactDir, {
				timestamp: new Date().toISOString(),
				phase,
				action: "dispatch",
				agent: handlerResult.agent,
				promptLength: handlerResult.prompt?.length,
				attempt,
			});

			// Check if this is a review dispatch that should be inlined
			const { inlined, reviewResult } = await maybeInlineReview(handlerResult, artifactDir);
			if (inlined && reviewResult) {
				const reloadedState = await loadState(artifactDir);
				if (reloadedState?.currentPhase) {
					const handler = PHASE_HANDLERS[reloadedState.currentPhase];
					const nextResult = await handler(reloadedState, artifactDir, reviewResult);
					return processHandlerResult(nextResult, reloadedState, artifactDir);
				}
				// State unavailable or pipeline completed after inline review — return complete
				return JSON.stringify({
					action: "complete",
					summary: "Inline review completed; no active phase.",
					_userProgress: progress,
				});
			}
			// Inject lesson + skill context into dispatch prompt (best-effort)
			if (handlerResult.prompt && handlerResult.phase) {
				const enrichedPrompt = await injectLessonContext(
					handlerResult.prompt,
					handlerResult.phase,
					artifactDir,
				);
				const withSkills = await injectSkillContext(
					enrichedPrompt,
					join(artifactDir, ".."),
					handlerResult.phase,
				);
				if (withSkills !== handlerResult.prompt) {
					return JSON.stringify({ ...handlerResult, prompt: withSkills, _userProgress: progress });
				}
			}
			return JSON.stringify({ ...handlerResult, _userProgress: progress });
		}

		case "dispatch_multi": {
			// Circuit breaker
			const phase = handlerResult.phase ?? currentState.currentPhase ?? "UNKNOWN";
			const { abortMsg, newCount: attempt } = await checkCircuitBreaker(
				currentState,
				phase,
				artifactDir,
			);
			if (abortMsg) return abortMsg;

			const progress = buildUserProgress(phase, handlerResult.progress, attempt);
			logOrchestrationEvent(artifactDir, {
				timestamp: new Date().toISOString(),
				phase,
				action: "dispatch_multi",
				agent: `${handlerResult.agents?.length ?? 0} agents`,
				attempt,
			});

			// Inject lesson + skill context into each agent's prompt (best-effort)
			// Load lesson and skill context once and reuse for all agents in the batch
			if (handlerResult.agents && handlerResult.phase) {
				const lessonSuffix = await injectLessonContext("", handlerResult.phase, artifactDir);
				const skillSuffix = await injectSkillContext(
					"",
					join(artifactDir, ".."),
					handlerResult.phase,
				);
				const combinedSuffix = lessonSuffix + (skillSuffix || "");
				if (combinedSuffix) {
					const enrichedAgents = handlerResult.agents.map((entry) => ({
						...entry,
						prompt: entry.prompt + combinedSuffix,
					}));
					return JSON.stringify({
						...handlerResult,
						agents: enrichedAgents,
						_userProgress: progress,
					});
				}
			}
			return JSON.stringify({ ...handlerResult, _userProgress: multiProgress });
		}

		case "complete": {
			if (currentState.currentPhase === null) {
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline completed. Idea: ${currentState.idea}`,
				});
			}

			logOrchestrationEvent(artifactDir, {
				timestamp: new Date().toISOString(),
				phase: currentState.currentPhase,
				action: "complete",
			});
			const nextPhase = getNextPhase(currentState.currentPhase);
			const advanced = completePhase(currentState);
			await saveState(advanced, artifactDir);

			if (nextPhase === null) {
				// Terminal phase completed
				const finished = { ...advanced, status: "COMPLETED" as const };
				await saveState(finished, artifactDir);
				const idx = PHASE_INDEX[currentState.currentPhase] ?? TOTAL_PHASES;
				return JSON.stringify({
					action: "complete",
					summary: `Pipeline completed all ${TOTAL_PHASES} phases. Idea: ${currentState.idea}`,
					_userProgress: `Completed ${currentState.currentPhase} (${idx}/${TOTAL_PHASES}), pipeline finished`,
				});
			}

			// Invoke the next phase handler immediately
			const nextHandler = PHASE_HANDLERS[nextPhase];
			const nextResult = await nextHandler(advanced, artifactDir);
			return processHandlerResult(nextResult, advanced, artifactDir);
		}

		default:
			return JSON.stringify({
				action: "error",
				message: `Unknown handler action: "${String((handlerResult as unknown as Record<string, unknown>).action)}"`,
			});
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
		const safeMessage = message.replace(/[/\\][^\s"']+/g, "[PATH]").slice(0, 4096);

		// Persist failure metadata for forensics (best-effort)
		try {
			const currentState = await loadState(artifactDir);
			if (currentState?.currentPhase) {
				const lastDone = currentState.phases.filter((p) => p.status === "DONE").pop();
				const failureContext = {
					failedPhase: currentState.currentPhase,
					failedAgent: null as string | null,
					errorMessage: safeMessage,
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

		return JSON.stringify({ action: "error", message: safeMessage });
	}
}

export const ocOrchestrate = tool({
	description:
		"Drive the orchestrator pipeline. Provide an idea to start a new run, or a result to advance the current phase. Returns JSON with action (dispatch/dispatch_multi/complete/error).",
	args: {
		idea: tool.schema
			.string()
			.max(4096)
			.optional()
			.describe("Idea to start a new orchestration run"),
		result: tool.schema
			.string()
			.max(1_048_576)
			.optional()
			.describe("Result from previous agent to advance the pipeline"),
	},
	async execute(args) {
		return orchestrateCore(args, getProjectArtifactDir(process.cwd()));
	},
});
