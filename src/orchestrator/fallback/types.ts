export type ErrorType =
	| "rate_limit"
	| "quota_exceeded"
	| "service_unavailable"
	| "missing_api_key"
	| "model_not_found"
	| "content_filter"
	| "context_length"
	| "unknown";

export type ContentTier = 1 | 2 | 3;

export interface FallbackState {
	readonly originalModel: string;
	readonly currentModel: string;
	readonly fallbackIndex: number; // -1 = primary
	readonly failedModels: ReadonlyMap<string, number>; // model -> timestamp
	readonly attemptCount: number;
}

export interface FallbackPlan {
	readonly failedModel: string;
	readonly newModel: string;
	readonly newFallbackIndex: number;
	readonly reason: string;
}

export interface FallbackPlanResult {
	readonly success: true;
	readonly plan: FallbackPlan;
}

export interface FallbackPlanFailure {
	readonly success: false;
	readonly reason: string;
}

export interface CommitResult {
	readonly committed: boolean;
	readonly state: FallbackState;
}

export interface MessagePart {
	readonly type: string;
	readonly [key: string]: unknown;
}
