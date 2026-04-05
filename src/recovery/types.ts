import type { ErrorCategory, RecoveryAction, RecoveryStrategy } from "../types/recovery";

export type ExtendedErrorCategory =
	| ErrorCategory
	| "empty_content"
	| "thinking_block_error"
	| "tool_result_overflow"
	| "context_window_exceeded"
	| "session_corruption"
	| "agent_loop_stuck";

export interface ClassificationResult {
	readonly category: ExtendedErrorCategory;
	readonly confidence: number;
	readonly reasoning: string;
	readonly isRecoverable: boolean;
}

export type ExtendedRecoveryStrategy =
	| RecoveryStrategy
	| "compact_and_retry"
	| "restart_session"
	| "reduce_context"
	| "skip_and_continue";

export interface RecoveryAttempt {
	readonly attemptNumber: number;
	readonly strategy: RecoveryStrategy | ExtendedRecoveryStrategy;
	readonly errorCategory: ExtendedErrorCategory;
	readonly timestamp: string;
	readonly success: boolean;
	readonly error?: string;
}

export interface RecoveryState {
	readonly sessionId: string;
	readonly attempts: readonly RecoveryAttempt[];
	readonly currentStrategy: ExtendedRecoveryStrategy | null;
	readonly maxAttempts: number;
	readonly isRecovering: boolean;
	readonly lastError: string | null;
}

export interface RecoveryActionEnvelope {
	readonly action: RecoveryAction;
	readonly state: RecoveryState;
}
