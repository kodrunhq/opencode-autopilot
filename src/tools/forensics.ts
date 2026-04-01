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

export async function forensicsCore(
	_args: Record<string, never>,
	projectRoot: string,
): Promise<string> {
	const artifactDir = getProjectArtifactDir(projectRoot);
	const state = await loadState(artifactDir);

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

	return JSON.stringify({
		failedPhase: failureContext.failedPhase,
		failedAgent: failureContext.failedAgent,
		errorMessage: failureContext.errorMessage,
		lastSuccessfulPhase: failureContext.lastSuccessfulPhase,
		recoverable,
		suggestedAction,
		phasesCompleted,
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
