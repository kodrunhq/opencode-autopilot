import type { ProgramOracleSignoff } from "../orchestrator/signoff";

export type LoopState =
	| "idle"
	| "running"
	| "verifying"
	| "oracle_verification_pending"
	| "verified"
	| "complete"
	| "failed"
	| "max_iterations";

export interface OracleVerificationState {
	readonly status: "pending" | "verified" | "failed";
	readonly sessionId: string | null;
	readonly attemptId: string | null;
	readonly attemptCount: number;
	readonly maxAttempts: number;
	readonly lastResultSummary: string | null;
	readonly resultAttemptId: string | null;
	readonly signoff: ProgramOracleSignoff | null;
}

export interface LoopContext {
	readonly taskDescription: string;
	readonly maxIterations: number;
	readonly currentIteration: number;
	readonly state: LoopState;
	readonly startedAt: string;
	readonly lastIterationAt: string | null;
	readonly accumulatedContext: readonly string[];
	readonly verificationResults: readonly VerificationResult[];
	readonly oracleVerification: OracleVerificationState | null;
}

export interface VerificationResult {
	readonly passed: boolean;
	readonly status: VerificationCheckStatus;
	readonly checks: readonly VerificationCheck[];
	readonly timestamp: string;
}

export type VerificationCheckStatus =
	| "PASSED"
	| "FAILED"
	| "BLOCKED"
	| "PENDING"
	| "SKIPPED_WITH_REASON";

export interface VerificationCheck {
	readonly name: string;
	readonly passed: boolean;
	readonly status: VerificationCheckStatus;
	readonly message: string;
}

export interface LoopOptions {
	readonly maxIterations?: number;
	readonly maxVerificationAttempts?: number;
	readonly verifyOnComplete?: boolean;
	readonly cooldownMs?: number;
}
