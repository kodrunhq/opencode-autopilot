import { tool } from "@opencode-ai/plugin";
import { appendDecision, loadState, patchState, saveState } from "../orchestrator/state";
import { getProjectArtifactDir } from "../utils/paths";

const PATCHABLE_FIELDS = ["status", "arenaConfidence", "exploreTriggered"] as const;

interface StateArgs {
	readonly subcommand: string;
	readonly field?: string;
	readonly value?: string;
	readonly phase?: string;
	readonly agent?: string;
	readonly decision?: string;
	readonly rationale?: string;
}

export async function stateCore(args: StateArgs, artifactDir: string): Promise<string> {
	try {
		switch (args.subcommand) {
			case "load": {
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				return JSON.stringify(state);
			}

			case "get": {
				if (!args.field) {
					return JSON.stringify({ error: "field required" });
				}
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const value = state[args.field as keyof typeof state];
				return JSON.stringify({ field: args.field, value });
			}

			case "patch": {
				if (!args.field) {
					return JSON.stringify({ error: "field required" });
				}
				if (!(PATCHABLE_FIELDS as readonly string[]).includes(args.field)) {
					return JSON.stringify({
						error: `field not patchable: ${args.field}. Allowed: ${PATCHABLE_FIELDS.join(", ")}`,
					});
				}
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const updated = patchState(state, { [args.field]: args.value });
				await saveState(updated, artifactDir);
				return JSON.stringify({ ok: true });
			}

			case "append-decision": {
				if (!args.phase || !args.agent || !args.decision || !args.rationale) {
					return JSON.stringify({
						error: "phase, agent, decision, and rationale are required",
					});
				}
				const state = await loadState(artifactDir);
				if (state === null) {
					return JSON.stringify({ error: "no_state" });
				}
				const updated = appendDecision(state, {
					phase: args.phase,
					agent: args.agent,
					decision: args.decision,
					rationale: args.rationale,
				});
				await saveState(updated, artifactDir);
				return JSON.stringify({ ok: true, decisions: updated.decisions.length });
			}

			default:
				return JSON.stringify({ error: `unknown subcommand: ${args.subcommand}` });
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return JSON.stringify({ error: message });
	}
}

export const ocState = tool({
	description:
		"Manage orchestrator pipeline state. Subcommands: load (full state), get (single field), patch (update field), append-decision (add decision entry).",
	args: {
		subcommand: tool.schema
			.enum(["load", "get", "patch", "append-decision"])
			.describe("Operation to perform"),
		field: tool.schema.string().optional().describe("Field name for get/patch subcommands"),
		value: tool.schema.string().optional().describe("Value for patch subcommand"),
		phase: tool.schema.string().optional().describe("Phase name for append-decision"),
		agent: tool.schema.string().optional().describe("Agent name for append-decision"),
		decision: tool.schema.string().optional().describe("Decision text for append-decision"),
		rationale: tool.schema.string().optional().describe("Rationale text for append-decision"),
	},
	async execute(args) {
		return stateCore(args, getProjectArtifactDir(process.cwd()));
	},
});
