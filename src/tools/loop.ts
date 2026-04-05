import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { getLoopController, type LoopController } from "../autonomy";

type LoopAction = "status" | "abort";

function buildDisplayText(action: LoopAction, controller: LoopController): string {
	const context = controller.getStatus();
	const lines = [
		`Loop action: ${action}`,
		`State: ${context.state}`,
		`Task: ${context.taskDescription || "No active task"}`,
		`Iteration: ${context.currentIteration}/${context.maxIterations}`,
		`Contexts: ${context.accumulatedContext.length}`,
		`Verification runs: ${context.verificationResults.length}`,
	];

	return lines.join("\n");
}

export async function loopCore(
	action: LoopAction,
	controller: LoopController = getLoopController(),
): Promise<string> {
	if (action === "abort") {
		controller.abort();
	}

	return JSON.stringify({
		action: `loop_${action}`,
		context: controller.getStatus(),
		displayText: buildDisplayText(action, controller),
	});
}

export const ocLoop = tool({
	description: "Inspect or abort the current autonomy loop.",
	args: {
		action: z.enum(["status", "abort"]).describe("Loop action to perform"),
	},
	async execute({ action }) {
		return loopCore(action);
	},
});
