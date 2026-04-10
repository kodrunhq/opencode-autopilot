import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { getLoopController, type LoopController } from "../autonomy";

type LoopAction = "status" | "abort" | "start" | "pause" | "resume" | "iterate";

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
	options?: {
		readonly taskDescription?: string;
		readonly maxIterations?: number;
		readonly iterationResult?: string;
	},
	controller: LoopController = getLoopController(),
): Promise<string> {
	switch (action) {
		case "start": {
			const description = options?.taskDescription ?? "Untitled task";
			controller.start(description, {
				maxIterations: options?.maxIterations,
			});
			break;
		}

		case "iterate": {
			const result = options?.iterationResult ?? "";
			await controller.iterate(result);
			break;
		}

		case "pause": {
			controller.pause();
			break;
		}

		case "resume": {
			controller.resume();
			break;
		}

		case "abort": {
			controller.abort();
			break;
		}

		case "status":
			break;
	}

	return JSON.stringify({
		action: `loop_${action}`,
		context: controller.getStatus(),
		displayText: buildDisplayText(action, controller),
	});
}

export const ocLoop = tool({
	description:
		"Manage the autonomy loop. Actions: start (begin new loop), iterate (advance with result), pause, resume, abort, status.",
	args: {
		action: z
			.enum(["status", "abort", "start", "pause", "resume", "iterate"])
			.describe("Loop action to perform"),
		taskDescription: z.string().min(1).optional().describe("Task description for the start action"),
		maxIterations: z
			.number()
			.int()
			.min(1)
			.max(100)
			.optional()
			.describe("Max iterations for the start action"),
		iterationResult: z
			.string()
			.optional()
			.describe("Result of the current iteration for the iterate action"),
	},
	async execute({ action, taskDescription, maxIterations, iterationResult }, context) {
		const controller = getLoopController(context.sessionID);
		return loopCore(action, { taskDescription, maxIterations, iterationResult }, controller);
	},
});
