import { getLogger } from "../logging/domains";
import type { Logger } from "../logging/types";
import { detectCompletion } from "./completion";
import { AUTONOMY_DEFAULTS } from "./config";
import type { OracleBridge, OracleBridgeDeps, OracleConsultation } from "./oracle-bridge";
import { TaskOracleBridge } from "./oracle-bridge";
import { LoopStateMachine } from "./state";
import type { LoopContext, LoopOptions } from "./types";
import { VerificationHandler } from "./verification";

export interface LoopControllerConfig {
	readonly maxIterations?: number;
	readonly verifyOnComplete?: boolean;
	readonly cooldownMs?: number;
	readonly logger?: Logger;
	readonly verificationHandler?: VerificationHandler;
	readonly oracleBridge?: OracleBridge;
	readonly sessionId?: string | null;
	readonly dispatchOracleTask?: OracleBridgeDeps["dispatchOracleTask"];
	readonly readOracleSessionMessages?: OracleBridgeDeps["readOracleSessionMessages"];
	readonly maxVerificationAttempts?: number;
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

function summarizeOracleFailure(
	summary: string,
	attemptCount: number,
	maxAttempts: number,
): string {
	return `Oracle verification failed (${attemptCount}/${maxAttempts}). Fix instructions: ${summary}`;
}

function maxOracleAttemptsMessage(maxAttempts: number): string {
	return `Oracle verification exceeded maximum attempts (${maxAttempts}). Manual review required.`;
}

const RETIRED_WORKER_COMPLETION_PROMISE =
	"<promise>DONE</promise> (retired after Oracle rejection)";

export class LoopController {
	private machine: LoopStateMachine;
	private paused = false;
	private maxIterations: number;
	private verifyOnComplete: boolean;
	private cooldownMs: number;
	private maxVerificationAttempts: number;
	private readonly logger: Logger;
	private readonly verificationHandler: VerificationHandler;
	private readonly oracleBridge: OracleBridge;
	private readonly sessionId: string | null;

	constructor(config: LoopControllerConfig = {}) {
		this.maxIterations = config.maxIterations ?? AUTONOMY_DEFAULTS.maxIterations;
		this.verifyOnComplete = config.verifyOnComplete ?? true;
		this.cooldownMs = config.cooldownMs ?? 0;
		this.maxVerificationAttempts =
			config.maxVerificationAttempts ?? AUTONOMY_DEFAULTS.maxVerificationAttempts;
		this.logger = config.logger ?? getLogger("autonomy", "controller");
		this.verificationHandler = config.verificationHandler ?? new VerificationHandler();
		this.sessionId = config.sessionId ?? null;
		this.oracleBridge =
			config.oracleBridge ??
			new TaskOracleBridge({
				dispatchOracleTask: config.dispatchOracleTask,
				readOracleSessionMessages: config.readOracleSessionMessages,
			});
		this.machine = new LoopStateMachine(this.maxIterations);
	}

	getSessionId(): string | null {
		return this.sessionId;
	}

	start(taskDescription: string, options: LoopOptions = {}): LoopContext {
		this.maxIterations = options.maxIterations ?? this.maxIterations;
		this.verifyOnComplete = options.verifyOnComplete ?? this.verifyOnComplete;
		this.cooldownMs = options.cooldownMs ?? this.cooldownMs;
		this.maxVerificationAttempts = options.maxVerificationAttempts ?? this.maxVerificationAttempts;
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
		if (this.paused) {
			return status;
		}

		if (status.state === "oracle_verification_pending") {
			return this.pollOracleVerification();
		}

		if (status.state !== "running") {
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

		if (!verificationResult.passed) {
			this.machine.transition("running");
			this.machine.addContext(summarizeFailedChecks(this.machine.getContext()));
			await this.applyCooldown();
			return this.machine.getContext();
		}

		const oracleVerification = this.machine.getContext().oracleVerification;
		if (oracleVerification?.status === "verified") {
			this.machine.transition("verified");
			this.machine.transition("complete");
			return this.machine.getContext();
		}

		let consultation: OracleConsultation;
		try {
			consultation = await this.oracleBridge.requestOracleConsultation({
				task: this.machine.getContext().taskDescription,
				completionEvidence: this.machine.getContext().accumulatedContext.join("\n"),
				parentSessionId: this.sessionId,
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			this.machine.transition("failed");
			this.machine.addContext(`Oracle verification dispatch failed: ${message}`);
			return this.machine.getContext();
		}

		this.machine.setOracleVerification({
			status: "pending",
			sessionId: consultation.sessionId,
			attemptId: consultation.attemptId,
			attemptCount: oracleVerification?.attemptCount ?? 0,
			maxAttempts: oracleVerification?.maxAttempts ?? this.maxVerificationAttempts,
			lastResultSummary: oracleVerification?.lastResultSummary ?? null,
			resultAttemptId: oracleVerification?.resultAttemptId ?? null,
		});
		this.machine.transition("oracle_verification_pending");
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
		if (
			status.state === "running" ||
			status.state === "verifying" ||
			status.state === "oracle_verification_pending"
		) {
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

	private async pollOracleVerification(): Promise<LoopContext> {
		const oracleVerification = this.machine.getContext().oracleVerification;
		if (!oracleVerification?.sessionId || !oracleVerification.attemptId || !this.sessionId) {
			this.machine.transition("failed");
			this.machine.addContext(
				"Oracle verification pending without session-scoped consultation data.",
			);
			return this.machine.getContext();
		}

		const oracleResult = await this.oracleBridge.checkOracleResult({
			sessionId: oracleVerification.sessionId,
			attemptId: oracleVerification.attemptId,
			parentSessionId: this.sessionId,
		});
		if (!oracleResult) {
			await this.applyCooldown();
			return this.machine.getContext();
		}

		if (oracleResult.status === "verified") {
			this.machine.setOracleVerification({
				...oracleVerification,
				status: "verified",
				lastResultSummary: oracleResult.summary,
				resultAttemptId: oracleResult.attemptId ?? oracleVerification.attemptId,
			});
			this.machine.transition("verified");
			this.machine.transition("complete");
			return this.machine.getContext();
		}

		const nextAttemptCount = oracleVerification.attemptCount + 1;
		this.machine.setOracleVerification({
			...oracleVerification,
			status: "failed",
			attemptCount: nextAttemptCount,
			lastResultSummary: oracleResult.summary,
			resultAttemptId: oracleResult.attemptId ?? oracleVerification.attemptId,
		});
		this.machine.retireContextSignal("<promise>DONE</promise>", RETIRED_WORKER_COMPLETION_PROMISE);

		if (nextAttemptCount >= oracleVerification.maxAttempts) {
			this.machine.transition("failed");
			this.machine.addContext(maxOracleAttemptsMessage(oracleVerification.maxAttempts));
			return this.machine.getContext();
		}

		this.machine.transition("running");
		this.machine.addContext(
			summarizeOracleFailure(
				oracleResult.summary,
				nextAttemptCount,
				oracleVerification.maxAttempts,
			),
		);
		await this.applyCooldown();
		return this.machine.getContext();
	}
}
