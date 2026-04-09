import { tool } from "@opencode-ai/plugin";
import { completePhase, getPhaseStatus, validateTransition } from "../orchestrator/phase";
import { phaseSchema } from "../orchestrator/schemas";
import { loadState, saveState } from "../orchestrator/state";
import { getProjectArtifactDir } from "../utils/paths";

interface PhaseArgs {
	readonly subcommand: string;
	readonly from?: string;
	readonly to?: string;
}

export async function phaseCore(args: PhaseArgs, artifactDir: string): Promise<string> {
	try {
		switch (args.subcommand) {
			case "status": {
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const currentPhase = state.currentPhase;
				if (currentPhase === null) {
					return JSON.stringify({
						currentPhase: null,
						status: state.status,
					});
				}
				const phaseStatus = getPhaseStatus(state, currentPhase);
				return JSON.stringify({
					currentPhase,
					status: phaseStatus?.status ?? "UNKNOWN",
				});
			}

			case "complete": {
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const previousPhase = state.currentPhase;
				const updated = completePhase(state);
				await saveState(updated, artifactDir);
				return JSON.stringify({
					ok: true,
					previousPhase,
					currentPhase: updated.currentPhase,
				});
			}

			case "validate": {
				if (!args.from || !args.to) {
					return JSON.stringify({
						error: "from and to phases are required",
					});
				}
				try {
					const fromPhase = phaseSchema.parse(args.from);
					const toPhase = phaseSchema.parse(args.to);
					validateTransition(fromPhase, toPhase);
					return JSON.stringify({ valid: true });
				} catch (validationError: unknown) {
					const message =
						validationError instanceof Error ? validationError.message : String(validationError);
					return JSON.stringify({ valid: false, error: message });
				}
			}

			default:
				return JSON.stringify({
					error: `unknown subcommand: ${args.subcommand}`,
				});
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return JSON.stringify({ error: message });
	}
}

export const ocPhase = tool({
	description:
		"Manage orchestrator phase transitions. Subcommands: status (current phase), complete (advance to next), validate (check transition validity).",
	args: {
		subcommand: tool.schema
			.enum(["status", "complete", "validate"])
			.describe("Operation to perform"),
		from: tool.schema.string().optional().describe("Source phase for validate subcommand"),
		to: tool.schema.string().optional().describe("Target phase for validate subcommand"),
	},
	async execute(args) {
		return phaseCore(args, getProjectArtifactDir(process.cwd()));
	},
});
