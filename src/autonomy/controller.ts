import { getLogger } from "../logging/domains";
import type { Logger } from "../logging/types";
import { detectCompletion } from "./completion";
import { LoopStateMachine } from "./state";
import type { LoopContext, LoopOptions } from "./types";
import { VerificationHandler } from "./verification";

export interface LoopControllerConfig {
	readonly maxIterations?: number;
	readonly verifyOnComplete?: boolean;
	readonly cooldownMs?: number;
	readonly logger?: Logger;
	readonly verificationHandler?: VerificationHandler;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeFailedChecks(context: LoopContext): string {
	const latestResult = context.verificationResults[context.verificationResults.length - 1];
	if (!latestResult) {
		return "Verification failed.";
	}

	const failedChecks = latestResult.checks
		.filter((check) => !check.passed)
		.map((check) => `${check.name}: ${check.message}`);

	return failedChecks.length > 0
		? `Verification failed: ${failedChecks.join("; ")}`
		: "Verification failed.";
}

export class LoopController {
	private machine: LoopStateMachine;
	private paused = false;
	private maxIterations: number;
	private verifyOnComplete: boolean;
	private cooldownMs: number;
	private readonly logger: Logger;
	private readonly verificationHandler: VerificationHandler;

	constructor(config: LoopControllerConfig = {}) {
		this.maxIterations = config.maxIterations ?? 10;
		this.verifyOnComplete = config.verifyOnComplete ?? true;
		this.cooldownMs = config.cooldownMs ?? 0;
		this.logger = config.logger ?? getLogger("autonomy", "controller");
		this.verificationHandler = config.verificationHandler ?? new VerificationHandler();
		this.machine = new LoopStateMachine(this.maxIterations);
	}

	start(taskDescription: string, options: LoopOptions = {}): LoopContext {
		this.maxIterations = options.maxIterations ?? this.maxIterations;
		this.verifyOnComplete = options.verifyOnComplete ?? this.verifyOnComplete;
		this.cooldownMs = options.cooldownMs ?? this.cooldownMs;
		this.paused = false;
		this.machine = new LoopStateMachine(this.maxIterations, taskDescription);
		this.machine.transition("running");
		this.logger.info("Autonomy loop started", {
			operation: "start",
			taskDescription,
			maxIterations: this.machine.getContext().maxIterations,
		});
		return this.machine.getContext();
	}

	async iterate(iterationResult: string): Promise<LoopContext> {
		const status = this.machine.getContext();
		if (this.paused || status.state !== "running") {
			return status;
		}

		this.machine.addContext(iterationResult);
		const exceeded = this.machine.incrementIteration();
		if (exceeded) {
			this.machine.transition("max_iterations");
			this.logger.warn("Autonomy loop hit max iterations", {
				operation: "iterate",
				currentIteration: this.machine.getContext().currentIteration,
			});
			return this.machine.getContext();
		}

		const completion = detectCompletion(this.machine.getContext().accumulatedContext);
		if (!completion.isComplete) {
			await this.applyCooldown();
			return this.machine.getContext();
		}

		if (!this.verifyOnComplete) {
			this.machine.transition("complete");
			return this.machine.getContext();
		}

		this.machine.transition("verifying");
		const verificationResult = await this.verificationHandler.verify(this.machine.getContext());
		this.machine.addVerificationResult(verificationResult);

		if (verificationResult.passed) {
			this.machine.transition("complete");
			return this.machine.getContext();
		}

		this.machine.transition("running");
		this.machine.addContext(summarizeFailedChecks(this.machine.getContext()));
		await this.applyCooldown();
		return this.machine.getContext();
	}

	pause(): LoopContext {
		this.paused = true;
		return this.machine.getContext();
	}

	resume(): LoopContext {
		this.paused = false;
		return this.machine.getContext();
	}

	abort(): LoopContext {
		const status = this.machine.getContext();
		if (status.state === "running" || status.state === "verifying") {
			this.machine.transition("failed");
			this.machine.addContext("Loop aborted by operator.");
			this.logger.warn("Autonomy loop aborted", { operation: "abort" });
		}
		return this.machine.getContext();
	}

	getStatus(): LoopContext {
		return this.machine.getContext();
	}

	isComplete(): boolean {
		return this.machine.getContext().state === "complete";
	}

	private async applyCooldown(): Promise<void> {
		if (this.cooldownMs > 0) {
			await delay(this.cooldownMs);
		}
	}
}
