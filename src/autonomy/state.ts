import { AUTONOMY_DEFAULTS } from "./config";
import type { LoopContext, LoopState, OracleVerificationState, VerificationResult } from "./types";

const DEFAULT_MAX_ITERATIONS = AUTONOMY_DEFAULTS.maxIterations;
const HARD_MAX_ITERATIONS = AUTONOMY_DEFAULTS.hardMaxIterations;

const VALID_TRANSITIONS = Object.freeze({
	idle: Object.freeze(["running"] as const),
	running: Object.freeze([
		"verifying",
		"oracle_verification_pending",
		"complete",
		"failed",
		"max_iterations",
	] as const),
	verifying: Object.freeze([
		"running",
		"oracle_verification_pending",
		"verified",
		"complete",
		"failed",
	] as const),
	oracle_verification_pending: Object.freeze(["running", "verified", "failed"] as const),
	verified: Object.freeze(["complete", "failed"] as const),
	complete: Object.freeze([] as const),
	failed: Object.freeze([] as const),
	max_iterations: Object.freeze([] as const),
}) satisfies Readonly<Record<LoopState, readonly LoopState[]>>;

function clampMaxIterations(maxIterations: number): number {
	return Math.max(1, Math.min(maxIterations, HARD_MAX_ITERATIONS));
}

function createInitialContext(maxIterations: number): LoopContext {
	return Object.freeze({
		taskDescription: "",
		maxIterations: clampMaxIterations(maxIterations),
		currentIteration: 0,
		state: "idle",
		startedAt: new Date().toISOString(),
		lastIterationAt: null,
		accumulatedContext: Object.freeze([]),
		verificationResults: Object.freeze([]),
		oracleVerification: null,
	});
}

export class LoopStateMachine {
	private context: LoopContext;

	constructor(maxIterations = DEFAULT_MAX_ITERATIONS, taskDescription = "") {
		this.context = Object.freeze({
			...createInitialContext(maxIterations),
			taskDescription,
		});
	}

	transition(to: LoopState): void {
		const validTargets: readonly LoopState[] = VALID_TRANSITIONS[this.context.state];
		if (!validTargets.includes(to)) {
			throw new Error(`Invalid loop state transition: ${this.context.state} -> ${to}`);
		}

		this.context = Object.freeze({
			...this.context,
			state: to,
		});
	}

	getContext(): LoopContext {
		return Object.freeze({
			...this.context,
			accumulatedContext: Object.freeze([...this.context.accumulatedContext]),
			verificationResults: Object.freeze([...this.context.verificationResults]),
			oracleVerification: this.context.oracleVerification
				? Object.freeze({ ...this.context.oracleVerification })
				: null,
		});
	}

	incrementIteration(): boolean {
		const nextIteration = this.context.currentIteration + 1;
		this.context = Object.freeze({
			...this.context,
			currentIteration: nextIteration,
			lastIterationAt: new Date().toISOString(),
		});

		return nextIteration > this.context.maxIterations;
	}

	addContext(text: string): void {
		this.context = Object.freeze({
			...this.context,
			accumulatedContext: Object.freeze([...this.context.accumulatedContext, text]),
		});
	}

	retireContextSignal(signal: string, replacement: string): void {
		let changed = false;
		const accumulatedContext = this.context.accumulatedContext.map((entry) => {
			if (!entry.includes(signal)) {
				return entry;
			}

			changed = true;
			return entry.split(signal).join(replacement);
		});

		if (!changed) {
			return;
		}

		this.context = Object.freeze({
			...this.context,
			accumulatedContext: Object.freeze(accumulatedContext),
		});
	}

	addVerificationResult(result: VerificationResult): void {
		this.context = Object.freeze({
			...this.context,
			verificationResults: Object.freeze([...this.context.verificationResults, result]),
		});
	}

	setOracleVerification(oracleVerification: OracleVerificationState | null): void {
		this.context = Object.freeze({
			...this.context,
			oracleVerification: oracleVerification ? Object.freeze({ ...oracleVerification }) : null,
		});
	}
}

export const loopStateMachineConstants = Object.freeze({
	DEFAULT_MAX_ITERATIONS,
	HARD_MAX_ITERATIONS,
});
