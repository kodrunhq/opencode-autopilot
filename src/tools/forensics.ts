import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { loadState } from "../orchestrator/state";
import { getProjectArtifactDir } from "../utils/paths";

/**
 * BUILD failures are terminal (strike overflow). All other phases are recoverable.
 */
function isRecoverable(failedPhase: string): boolean {
	return failedPhase !== "BUILD";
}

/**
 * Suggest the best recovery action based on failed phase and recoverability.
 * - Not recoverable -> "restart"
 * - RECON (nothing completed to resume from) -> "restart"
 * - All other recoverable phases -> "resume"
 */
function getSuggestedAction(failedPhase: string, recoverable: boolean): "resume" | "restart" {
	if (!recoverable) return "restart";
	if (failedPhase === "RECON") return "restart";
	return "resume";
}

async function readRecentContractEvents(artifactDir: string): Promise<readonly string[]> {
	try {
		const raw = await readFile(join(artifactDir, "orchestration.jsonl"), "utf-8");
		const lines = raw
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.slice(-120);
		const codes = new Set<string>();
		for (const line of lines) {
			for (const code of [
				"E_INVALID_RESULT",
				"E_STALE_RESULT",
				"E_PHASE_MISMATCH",
				"E_UNKNOWN_DISPATCH",
				"E_DUPLICATE_RESULT",
				"E_BUILD_TASK_ID_REQUIRED",
				"E_BUILD_UNKNOWN_TASK",
			]) {
				if (line.includes(code)) {
					codes.add(code);
				}
			}
		}
		return Object.freeze([...codes].sort());
	} catch {
		return Object.freeze([]);
	}
}

export async function forensicsCore(
	_args: Record<string, never>,
	projectRoot: string,
): Promise<string> {
	const artifactDir = getProjectArtifactDir(projectRoot);
	let state: Awaited<ReturnType<typeof loadState>>;
	try {
		state = await loadState(artifactDir);
	} catch (error: unknown) {
		const detail =
			error instanceof SyntaxError
				? "state file contains invalid JSON"
				: error !== null && typeof error === "object" && "issues" in error
					? "state file failed schema validation"
					: "state file is unreadable";
		return JSON.stringify({
			action: "error",
			message: `Pipeline state is corrupt: ${detail}`,
			recoverable: false,
			suggestedAction: "manual",
		});
	}

	if (state === null) {
		return JSON.stringify({ action: "error", message: "No pipeline state found" });
	}

	if (state.status !== "FAILED") {
		return JSON.stringify({
			action: "error",
			message: `No failure to diagnose -- pipeline status: ${state.status}`,
		});
	}

	if (!state.failureContext) {
		return JSON.stringify({
			action: "error",
			message: "No failure metadata recorded",
		});
	}

	const { failureContext } = state;
	const recoverable = isRecoverable(failureContext.failedPhase);
	const suggestedAction = getSuggestedAction(failureContext.failedPhase, recoverable);
	const phasesCompleted = state.phases.filter((p) => p.status === "DONE").map((p) => p.name);
	const deterministicErrorCodes = await readRecentContractEvents(artifactDir);

	return JSON.stringify({
		failedPhase: failureContext.failedPhase,
		failedAgent: failureContext.failedAgent,
		errorMessage: failureContext.errorMessage,
		lastSuccessfulPhase: failureContext.lastSuccessfulPhase,
		recoverable,
		suggestedAction,
		phasesCompleted,
		deterministicErrorCodes,
	});
}

export const ocForensics = tool({
	description:
		"Diagnose a failed orchestrator pipeline run. Returns structured JSON with failing phase, root cause, and whether the failure is recoverable. Invoke after a pipeline error.",
	args: {},
	async execute(_args) {
		return forensicsCore({}, process.cwd());
	},
});
