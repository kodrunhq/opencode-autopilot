import type { MockFailureMode } from "./types";

/**
 * Default error messages for each failure mode.
 */
const DEFAULT_MESSAGES: Readonly<Record<MockFailureMode, string>> = Object.freeze({
	rate_limit: "Rate limit exceeded",
	quota_exceeded: "Quota exceeded",
	timeout: "Request timeout — service unavailable (504)",
	malformed: "Malformed response from model",
	service_unavailable: "Service unavailable",
});

/**
 * Creates a deterministic error object for the given failure mode.
 * Generated errors match the shapes consumed by classifyErrorType in
 * src/orchestrator/fallback/error-classifier.ts.
 *
 * This is a test utility -- not a real provider registration.
 * Each returned error object is frozen for immutability.
 *
 * @param mode - The failure mode to simulate
 * @param customMessage - Optional override for the default error message
 * @returns A frozen error-like object matching SDK error shapes
 */
export function createMockError(mode: MockFailureMode, customMessage?: string): unknown {
	const message = customMessage ?? DEFAULT_MESSAGES[mode];

	switch (mode) {
		case "rate_limit":
			return Object.freeze({
				name: "APIError",
				status: 429,
				statusCode: 429,
				message,
				error: Object.freeze({ message }),
			});

		case "quota_exceeded":
			return Object.freeze({
				name: "APIError",
				status: 402,
				statusCode: 402,
				message,
				error: Object.freeze({ message }),
			});

		case "timeout":
			return Object.freeze({
				name: "APIError",
				status: 504,
				statusCode: 504,
				message,
				error: Object.freeze({ message }),
			});

		case "malformed":
			return Object.freeze({
				name: "UnknownError",
				message,
			});

		case "service_unavailable":
			return Object.freeze({
				name: "APIError",
				status: 503,
				statusCode: 503,
				message,
				error: Object.freeze({ message }),
			});
	}
}
