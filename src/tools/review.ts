/**
 * oc_review tool -- multi-agent code review.
 *
 * Stateful between invocations:
 * - scope arg -> start new review (stage 1 dispatch)
 * - findings arg -> advance pipeline to next stage
 * - no args with active state -> return status
 * - no args without state -> error
 *
 * State persisted at {projectRoot}/.opencode-autopilot/current-review.json
 * Memory persisted at {projectRoot}/.opencode-autopilot/review-memory.json
 */

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { tool } from "@opencode-ai/plugin";
import { REVIEW_AGENTS, SPECIALIZED_AGENTS } from "../review/agents/index";
import {
	createEmptyMemory,
	loadReviewMemory,
	pruneMemory,
	saveReviewMemory,
} from "../review/memory";
import type { ReviewState } from "../review/pipeline";
import { advancePipeline } from "../review/pipeline";
import { reviewFindingsEnvelopeSchema, reviewStateSchema } from "../review/schemas";
import { selectAgents } from "../review/selection";
import { detectStackTags } from "../review/stack-gate";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { getProjectArtifactDir } from "../utils/paths";

interface ReviewArgs {
	readonly scope?: string;
	readonly filter?: string;
	readonly directory?: string;
	readonly findings?: string;
}

const execFileAsync = promisify(execFile);

const STATE_FILE = "current-review.json";

/**
 * Get changed file paths for the given review scope.
 * Uses execFile (not exec) to prevent shell injection.
 * Returns empty array on any error (best-effort).
 */
async function getChangedFiles(
	scope: string,
	projectRoot: string,
	directory?: string,
): Promise<readonly string[]> {
	try {
		let args: string[];
		switch (scope) {
			case "staged":
				args = ["diff", "--cached", "--name-only"];
				break;
			case "unstaged":
				args = ["diff", "--name-only"];
				break;
			case "branch":
				args = ["diff-tree", "--no-commit-id", "--name-only", "--root", "-r", "HEAD"];
				break;
			case "directory":
				args = directory ? ["diff", "--name-only", "--", directory] : ["diff", "--name-only"];
				break;
			default:
				args = ["diff", "--name-only", "HEAD"];
				break;
		}
		const { stdout } = await execFileAsync("git", args, { cwd: projectRoot, timeout: 10000 });
		return stdout.trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

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
	const tmpPath = `${statePath}.tmp.${randomBytes(8).toString("hex")}`;
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
 * Start a new review -- detect stacks, select agents, and build stage 1 dispatch prompts.
 */
async function startNewReview(
	scope: string,
	projectRoot: string,
	options?: { readonly filter?: string; readonly directory?: string },
): Promise<{
	readonly state: ReviewState;
	readonly agents: readonly { readonly name: string; readonly prompt: string }[];
}> {
	// Detect stacks from changed files via git (run in projectRoot)
	const changedFiles = await getChangedFiles(scope, projectRoot, options?.directory);
	const detectedStacks = detectStackTags(changedFiles);

	// Build diff analysis from changed file paths
	const diffAnalysis = {
		hasTests: changedFiles.some((f) => f.includes("test") || f.includes("spec")),
		hasAuth: changedFiles.some(
			(f) => f.includes("auth") || f.includes("login") || f.includes("session"),
		),
		hasConfig: changedFiles.some(
			(f) => f.includes("config") || f.includes("settings") || f.includes(".env"),
		),
		fileCount: changedFiles.length,
	};

	// Select agents from all candidates (universal + specialized)
	const allCandidates = [...REVIEW_AGENTS, ...SPECIALIZED_AGENTS];
	const selection = selectAgents(detectedStacks, diffAnalysis, allCandidates);

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
			const { state, agents } = await startNewReview(args.scope, projectRoot, {
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
			let findingsPayload = args.findings;
			try {
				const parsed = JSON.parse(args.findings);
				if (
					parsed &&
					typeof parsed === "object" &&
					"report" in parsed &&
					typeof parsed.report === "object" &&
					parsed.report !== null &&
					Array.isArray((parsed.report as { findings?: unknown }).findings)
				) {
					findingsPayload = JSON.stringify(
						reviewFindingsEnvelopeSchema.parse({
							schemaVersion: 1,
							kind: "review_findings",
							findings: (parsed.report as { findings: unknown[] }).findings,
						}),
					);
				}
			} catch {
				// keep legacy payload for parser fallback
			}
			const result = advancePipeline(findingsPayload, currentState);

			if (result.action === "dispatch" && result.state) {
				await saveReviewState(result.state, artifactDir);
				return JSON.stringify({
					action: "dispatch",
					stage: result.stage,
					agents: result.agents,
					message: result.message,
					parseMode: result.parseMode,
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
					findingsEnvelope: result.findingsEnvelope,
					parseMode: result.parseMode,
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
