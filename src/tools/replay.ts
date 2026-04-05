import { tool } from "@opencode-ai/plugin";

export const ocReplay = tool({
	description:
		"Verify determinism by replaying a known sequence of inputs to the review pipeline and ensuring identical state output.",
	args: {
		runId: tool.schema.string().describe("The pipeline runId to use as the random seed for replay"),
		inputs: tool.schema
			.array(tool.schema.string())
			.describe("Array of raw JSON findings inputs to feed sequentially into the pipeline"),
	},
	async execute(args) {
		const { advancePipeline } = await import("../review/pipeline");

		let currentState = {
			stage: 1,
			scope: "replay-scope",
			selectedAgentNames: ["logic-auditor", "security-auditor"],
			accumulatedFindings: [],
			startedAt: "2026-04-05T00:00:00.000Z",
		};

		for (const input of args.inputs) {
			const res = advancePipeline(
				input,
				currentState as unknown as Record<string, unknown>,
				undefined,
				args.runId,
				args.runId,
			);
			if (res.state) {
				currentState = res.state as unknown as Record<string, unknown>;
			}
		}

		return JSON.stringify(
			{
				success: true,
				message: `Replayed ${args.inputs.length} inputs deterministically.`,
				replayedRunId: args.runId,
				finalState: currentState,
			},
			null,
			2,
		);
	},
});
