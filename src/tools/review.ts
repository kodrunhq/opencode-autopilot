/**
 * oc_review tool -- multi-agent code review.
 *
 * Stateful between invocations:
 * - scope arg -> start new review (stage 1 dispatch)
 * - findings arg -> advance pipeline to next stage
 * - no args with active state -> return status
 * - no args without state -> error
 *
 * State persisted at {projectRoot}/.opencode-assets/current-review.json
 * Memory persisted at {projectRoot}/.opencode-assets/review-memory.json
 */

import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { REVIEW_AGENTS } from "../review/agents/index";
import {
	createEmptyMemory,
	loadReviewMemory,
	pruneMemory,
	saveReviewMemory,
} from "../review/memory";
import type { ReviewState } from "../review/pipeline";
import { advancePipeline } from "../review/pipeline";
import { reviewStateSchema } from "../review/schemas";
import { selectAgents } from "../review/selection";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { getProjectArtifactDir } from "../utils/paths";

interface ReviewArgs {
	readonly scope?: string;
	readonly filter?: string;
	readonly directory?: string;
	readonly findings?: string;
}

const STATE_FILE = "current-review.json";

/**
 * Load review state from disk. Returns null if no active review.
 */
async function loadReviewState(artifactDir: string): Promise<ReviewState | null> {
	const statePath = join(artifactDir, STATE_FILE);
	try {
		const raw = await readFile(statePath, "utf-8");
		const parsed = JSON.parse(raw);
		return reviewStateSchema.parse(parsed) as ReviewState;
	} catch (error: unknown) {
		if (isEnoentError(error)) return null;
		// Treat parse/schema errors as recoverable — delete corrupt file
		if (error instanceof SyntaxError || (error && typeof error === "object" && "issues" in error)) {
			try {
				await unlink(statePath);
			} catch {
				/* ignore cleanup errors */
			}
			return null;
		}
		throw error;
	}
}

/**
 * Save review state atomically.
 */
async function saveReviewState(state: ReviewState, artifactDir: string): Promise<void> {
	await ensureDir(artifactDir);
	// Validate before writing (bidirectional validation, same as orchestrator state)
	const validated = reviewStateSchema.parse(state);
	const statePath = join(artifactDir, STATE_FILE);
	const tmpPath = `${statePath}.tmp.${Date.now()}`;
	await writeFile(tmpPath, JSON.stringify(validated, null, 2), "utf-8");
	await rename(tmpPath, statePath);
}

/**
 * Delete review state file (pipeline complete or error cleanup).
 */
async function clearReviewState(artifactDir: string): Promise<void> {
	const statePath = join(artifactDir, STATE_FILE);
	try {
		await unlink(statePath);
	} catch (error: unknown) {
		if (!isEnoentError(error)) throw error;
	}
}

/**
 * Start a new review -- select agents and build stage 1 dispatch prompts.
 */
function startNewReview(
	scope: string,
	_options?: { readonly filter?: string; readonly directory?: string },
): {
	readonly state: ReviewState;
	readonly agents: readonly { readonly name: string; readonly prompt: string }[];
} {
	// Detect stacks (simplified -- no actual project analysis yet)
	const detectedStacks: readonly string[] = [];

	// Select agents via stack gate
	const selection = selectAgents(
		detectedStacks,
		{ hasTests: false, hasAuth: false, hasConfig: false, fileCount: 0 },
		REVIEW_AGENTS,
	);

	const selectedNames = selection.selected.map((a) => a.name);

	// Build stage 1 prompts (specialist review with diff placeholder)
	const agentPrompts = selection.selected.map((agent) => {
		const prompt = agent.prompt
			.replace("{{DIFF}}", `[Diff for scope: ${scope}]`)
			.replace("{{PRIOR_FINDINGS}}", "No prior findings yet.")
			.replace("{{MEMORY}}", "");
		return Object.freeze({ name: agent.name, prompt });
	});

	const state: ReviewState = {
		stage: 1,
		selectedAgentNames: selectedNames,
		accumulatedFindings: [],
		scope,
		startedAt: new Date().toISOString(),
	};

	return { state, agents: Object.freeze(agentPrompts) };
}

export async function reviewCore(args: ReviewArgs, projectRoot: string): Promise<string> {
	try {
		const artifactDir = getProjectArtifactDir(projectRoot);
		const currentState = await loadReviewState(artifactDir);

		// Case 1: No state, scope provided -> start new review
		if (currentState === null && args.scope) {
			const { state, agents } = startNewReview(args.scope, {
				filter: args.filter,
				directory: args.directory,
			});

			// Load memory for false positive context
			const memory = await loadReviewMemory(projectRoot);
			if (memory) {
				// Inject false positive context into prompts (via {{MEMORY}} already replaced above)
				// Future enhancement: pass FP context to agent prompts
			}

			await saveReviewState(state, artifactDir);

			return JSON.stringify({
				action: "dispatch",
				stage: 1,
				agents,
			});
		}

		// Case 2: No state, no scope -> error
		if (currentState === null && !args.scope) {
			return JSON.stringify({
				action: "error",
				message: "No active review. Provide scope to start.",
			});
		}

		// Case 3: State exists, findings provided -> advance pipeline
		if (currentState !== null && args.findings) {
			const result = advancePipeline(args.findings, currentState);

			if (result.action === "dispatch" && result.state) {
				await saveReviewState(result.state, artifactDir);
				return JSON.stringify({
					action: "dispatch",
					stage: result.stage,
					agents: result.agents,
					message: result.message,
				});
			}

			if (result.action === "complete") {
				// Update memory with findings
				const memory = (await loadReviewMemory(projectRoot)) ?? createEmptyMemory();
				const updatedMemory = pruneMemory({
					...memory,
					recentFindings: [...memory.recentFindings, ...(result.report?.findings ?? [])],
					lastReviewedAt: new Date().toISOString(),
				});
				await saveReviewMemory(updatedMemory, projectRoot);

				// Clear state
				await clearReviewState(artifactDir);

				return JSON.stringify({
					action: "complete",
					report: result.report,
				});
			}

			if (result.action === "error") {
				await clearReviewState(artifactDir);
				return JSON.stringify({
					action: "error",
					message: result.message ?? "Pipeline error",
				});
			}
		}

		// Case 4: State exists, no findings -> return status
		if (currentState !== null && !args.findings) {
			return JSON.stringify({
				action: "status",
				stage: currentState.stage,
				message: "Awaiting findings from dispatched agents",
			});
		}

		return JSON.stringify({ action: "error", message: "Unexpected state" });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return JSON.stringify({ action: "error", message });
	}
}

export const ocReview = tool({
	description:
		"Run multi-agent code review. Provide scope (staged|unstaged|branch|all|directory) to start, or findings from dispatched agents to advance the pipeline. Returns JSON with action (dispatch|complete|status|error).",
	args: {
		scope: tool.schema
			.enum(["staged", "unstaged", "branch", "all", "directory"])
			.optional()
			.describe("Review scope"),
		filter: tool.schema.string().optional().describe("Regex pattern to filter files"),
		directory: tool.schema.string().optional().describe("Directory path for directory scope"),
		findings: tool.schema
			.string()
			.optional()
			.describe("JSON findings from previously dispatched review agents"),
	},
	async execute(args) {
		return reviewCore(args, process.cwd());
	},
});
