import type { ErrorCategory, RecoveryAction, RecoveryStrategy } from "../types/recovery";

export interface ClassificationResult {
	readonly category: ErrorCategory;
	readonly confidence: number;
	readonly reasoning: string;
	readonly isRecoverable: boolean;
}

export interface RecoveryAttempt {
	readonly attemptNumber: number;
	readonly strategy: RecoveryStrategy;
	readonly errorCategory: ErrorCategory;
	readonly timestamp: string;
	readonly success: boolean;
	readonly error?: string;
}

export interface RecoveryState {
	readonly sessionId: string;
	readonly attempts: readonly RecoveryAttempt[];
	readonly currentStrategy: RecoveryStrategy | null;
	readonly maxAttempts: number;
	readonly isRecovering: boolean;
	readonly lastError: string | null;
}

export interface RecoveryActionEnvelope {
	readonly action: RecoveryAction;
	readonly state: RecoveryState;
}
