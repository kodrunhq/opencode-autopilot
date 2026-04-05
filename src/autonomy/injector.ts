import type { LoopController } from "./controller";

const LOOP_CONTEXT_CHAR_BUDGET = 500;

interface LoopInjectorInput {
	readonly sessionID: string;
}

interface LoopInjectorOutput {
	system: string;
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

export function createLoopInjector(controller: LoopController) {
	return async (_input: LoopInjectorInput, output: LoopInjectorOutput): Promise<void> => {
		if (controller.getStatus().state === "idle") {
			return;
		}

		const loopContext = buildLoopContext(controller);
		output.system = output.system.length > 0 ? `${output.system}\n\n${loopContext}` : loopContext;
	};
}

export const loopInjectorConstants = Object.freeze({
	LOOP_CONTEXT_CHAR_BUDGET,
});
