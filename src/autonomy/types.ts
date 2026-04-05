export type LoopState = "idle" | "running" | "verifying" | "complete" | "failed" | "max_iterations";

export interface LoopContext {
	readonly taskDescription: string;
	readonly maxIterations: number;
	readonly currentIteration: number;
	readonly state: LoopState;
	readonly startedAt: string;
	readonly lastIterationAt: string | null;
	readonly accumulatedContext: readonly string[];
	readonly verificationResults: readonly VerificationResult[];
}

export interface VerificationResult {
	readonly passed: boolean;
	readonly checks: readonly VerificationCheck[];
	readonly timestamp: string;
}

export interface VerificationCheck {
	readonly name: string;
	readonly passed: boolean;
	readonly message: string;
}

export interface LoopOptions {
	readonly maxIterations?: number;
	readonly verifyOnComplete?: boolean;
	readonly cooldownMs?: number;
}
