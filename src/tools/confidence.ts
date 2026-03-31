import { tool } from "@opencode-ai/plugin";
import { appendConfidence, filterByPhase, summarizeConfidence } from "../orchestrator/confidence";
import { phaseSchema } from "../orchestrator/schemas";
import { loadState, saveState } from "../orchestrator/state";
import { getProjectArtifactDir } from "../utils/paths";

interface ConfidenceArgs {
	readonly subcommand: string;
	readonly phase?: string;
	readonly agent?: string;
	readonly area?: string;
	readonly level?: string;
	readonly rationale?: string;
}

export async function confidenceCore(args: ConfidenceArgs, artifactDir: string): Promise<string> {
	try {
		switch (args.subcommand) {
			case "append": {
				if (!args.phase || !args.agent || !args.area || !args.level || !args.rationale) {
					return JSON.stringify({
						error: "phase, agent, area, level, and rationale are required",
					});
				}
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const updated = appendConfidence(state, {
					phase: args.phase,
					agent: args.agent,
					area: args.area,
					level: args.level as "HIGH" | "MEDIUM" | "LOW",
					rationale: args.rationale,
				});
				await saveState(updated, artifactDir);
				return JSON.stringify({
					ok: true,
					entries: updated.confidence.length,
				});
			}

			case "summary": {
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const summary = summarizeConfidence(state.confidence);
				return JSON.stringify(summary);
			}

			case "filter": {
				if (!args.phase) {
					return JSON.stringify({ error: "phase required for filter" });
				}
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const validPhase = phaseSchema.parse(args.phase);
				const filtered = filterByPhase(state.confidence, validPhase);
				return JSON.stringify({ entries: filtered });
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

export const ocConfidence = tool({
	description:
		"Manage orchestrator confidence ledger. Subcommands: append (add entry), summary (aggregate counts), filter (entries by phase).",
	args: {
		subcommand: tool.schema.enum(["append", "summary", "filter"]).describe("Operation to perform"),
		phase: tool.schema.string().optional().describe("Phase name for append/filter"),
		agent: tool.schema.string().optional().describe("Agent name for append"),
		area: tool.schema.string().optional().describe("Area of confidence for append"),
		level: tool.schema
			.enum(["HIGH", "MEDIUM", "LOW"])
			.optional()
			.describe("Confidence level for append"),
		rationale: tool.schema.string().optional().describe("Rationale text for append"),
	},
	async execute(args) {
		return confidenceCore(args, getProjectArtifactDir(process.cwd()));
	},
});
