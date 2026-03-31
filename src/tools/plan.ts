import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { countByStatus, groupByWave } from "../orchestrator/plan";
import { loadState } from "../orchestrator/state";

interface PlanArgs {
	readonly subcommand: string;
}

export async function planCore(args: PlanArgs, artifactDir: string): Promise<string> {
	try {
		switch (args.subcommand) {
			case "waves": {
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const waveMap = groupByWave(state.tasks);
				// Convert Map to plain object for JSON serialization
				const waves: Record<string, readonly unknown[]> = {};
				for (const [wave, tasks] of waveMap) {
					waves[String(wave)] = tasks;
				}
				return JSON.stringify({ waves });
			}

			case "status-count": {
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const counts = countByStatus(state.tasks);
				return JSON.stringify(counts);
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

export const ocPlan = tool({
	description:
		"Query orchestrator plan data. Subcommands: waves (tasks grouped by wave), status-count (task counts by status).",
	args: {
		subcommand: tool.schema.enum(["waves", "status-count"]).describe("Operation to perform"),
	},
	async execute(args) {
		return planCore(args, join(process.cwd(), ".opencode-assets"));
	},
});
