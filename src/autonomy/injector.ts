import type { LoopController } from "./controller";

const LOOP_CONTEXT_CHAR_BUDGET = 500;

interface LoopInjectorInput {
	readonly sessionID?: string;
}

interface LoopInjectorOutput {
	system: string[];
}

function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function buildLoopContext(controller: LoopController): string {
	const status = controller.getStatus();
	const remainingIterations = Math.max(0, status.maxIterations - status.currentIteration);
	const lastContext = status.accumulatedContext[status.accumulatedContext.length - 1] ?? "None";
	const baseContext = [
		"[Autonomy Loop]",
		`State: ${status.state}`,
		`Current iteration: ${status.currentIteration} of ${status.maxIterations}`,
		`Remaining iterations: ${remainingIterations}`,
		`Last context: ${lastContext}`,
	].join("\n");

	return truncate(baseContext, LOOP_CONTEXT_CHAR_BUDGET);
}

type LoopControllerResolver = (sessionID?: string) => LoopController | null;

export function createLoopInjector(controller: LoopController | LoopControllerResolver) {
	const resolveController: LoopControllerResolver =
		typeof controller === "function" ? controller : () => controller;

	return async (input: LoopInjectorInput, output: LoopInjectorOutput): Promise<void> => {
		const resolvedController = resolveController(input.sessionID);
		if (!resolvedController) {
			return;
		}

		if (resolvedController.getStatus().state === "idle") {
			return;
		}

		const loopContext = buildLoopContext(resolvedController);
		output.system.push(loopContext);
	};
}

export const loopInjectorConstants = Object.freeze({
	LOOP_CONTEXT_CHAR_BUDGET,
});
