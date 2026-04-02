/**
 * Mock failure modes for fallback chain testing.
 * Each mode generates a deterministic error object that feeds into the existing
 * error classifier (src/orchestrator/fallback/error-classifier.ts).
 */
export type MockFailureMode =
	| "rate_limit"
	| "quota_exceeded"
	| "timeout"
	| "malformed"
	| "service_unavailable";

/**
 * All valid failure modes as a frozen readonly array.
 */
export const FAILURE_MODES: readonly MockFailureMode[] = Object.freeze([
	"rate_limit",
	"quota_exceeded",
	"timeout",
	"malformed",
	"service_unavailable",
] as const);

/**
 * Configuration for a mock error provider instance.
 */
export interface MockProviderConfig {
	readonly mode: MockFailureMode;
	readonly delayMs?: number;
	readonly customMessage?: string;
}
