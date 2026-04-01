import type { ErrorType } from "./types";

export const RETRYABLE_ERROR_PATTERNS: readonly RegExp[] = Object.freeze([
	/rate.?limit/i,
	/too.?many.?requests/i,
	/quota.?exceeded/i,
	/quota.?protection/i,
	/key.?limit.?exceeded/i,
	/usage\s+limit\s+has\s+been\s+reached/i,
	/service.?unavailable/i,
	/overloaded/i,
	/temporarily.?unavailable/i,
	/try.?again/i,
	/credit.*balance.*too.*low/i,
	/insufficient.?(?:credits?|funds?|balance)/i,
	/(?:^|\s)429(?:\s|$)/,
	/(?:^|\s)503(?:\s|$)/,
	/(?:^|\s)529(?:\s|$)/,
]);

/**
 * Extracts a human-readable error message from an unknown error value.
 * Handles nested error.error.message, error.message, error.error, and string errors.
 */
export function getErrorMessage(error: unknown): string {
	if (error === null || error === undefined) return "";
	if (typeof error === "string") return error;

	if (typeof error === "object") {
		const obj = error as Record<string, unknown>;

		// Check nested error.error.message first
		if (obj.error && typeof obj.error === "object") {
			const nested = obj.error as Record<string, unknown>;
			if (typeof nested.message === "string") return nested.message;
		}

		// Check error.message
		if (typeof obj.message === "string") return obj.message;

		// Check error.error as string
		if (typeof obj.error === "string") return obj.error;
	}

	return "";
}

/**
 * Extracts a status code from an error if it matches the retryable set.
 * Checks error.status, error.statusCode, and message text.
 */
export function extractStatusCode(error: unknown, retryOnErrors: readonly number[]): number | null {
	if (error !== null && typeof error === "object") {
		const obj = error as Record<string, unknown>;

		if (typeof obj.status === "number" && retryOnErrors.includes(obj.status)) {
			return obj.status;
		}
		if (typeof obj.statusCode === "number" && retryOnErrors.includes(obj.statusCode)) {
			return obj.statusCode;
		}
	}

	// Extract from message text — restrict to 4xx/5xx to avoid false positives
	const message = getErrorMessage(error);
	const matches = message.matchAll(/\b([45]\d{2})\b/g);
	for (const m of matches) {
		const code = Number.parseInt(m[1], 10);
		if (retryOnErrors.includes(code)) return code;
	}

	return null;
}

/**
 * Classifies an error into a known ErrorType category based on message patterns and status codes.
 */
export function classifyErrorType(error: unknown): ErrorType {
	const message = getErrorMessage(error);
	const lowerMessage = message.toLowerCase();

	// Check status code first
	if (error !== null && typeof error === "object") {
		const obj = error as Record<string, unknown>;
		if (obj.status === 429 || obj.statusCode === 429) return "rate_limit";
	}

	// Check message patterns
	if (
		/api.?key/i.test(message) &&
		/missing|no\s|not\s+(?:provided|found|set|configured)/i.test(message)
	)
		return "missing_api_key";
	if (/model.*not.*(?:found|exist)/i.test(message)) return "model_not_found";
	if (/content.?filter/i.test(message)) return "content_filter";
	if (/context.?length/i.test(message)) return "context_length";
	if (/rate.?limit/i.test(lowerMessage) || /too.?many.?requests/i.test(lowerMessage))
		return "rate_limit";
	if (
		/quota.?exceeded/i.test(lowerMessage) ||
		/insufficient.?(?:credits?|funds?|balance)/i.test(lowerMessage)
	)
		return "quota_exceeded";
	if (/service.?unavailable/i.test(lowerMessage) || /overloaded/i.test(lowerMessage))
		return "service_unavailable";

	return "unknown";
}

/**
 * Determines whether an error is retryable by another model.
 * Checks status codes, built-in patterns, error type, and user-provided patterns.
 */
export function isRetryableError(
	error: unknown,
	retryOnErrors: readonly number[],
	userPatterns?: readonly string[],
): boolean {
	const errorType = classifyErrorType(error);

	// content_filter: same content will fail on any model.
	// context_length: replay would fail without truncation; caller must truncate first.
	if (errorType === "content_filter" || errorType === "context_length") return false;

	if (errorType === "missing_api_key" || errorType === "model_not_found") return true;

	const statusCode = extractStatusCode(error, retryOnErrors);
	if (statusCode !== null && retryOnErrors.includes(statusCode)) return true;

	const message = getErrorMessage(error);
	if (RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return true;

	if (userPatterns) {
		for (const patternStr of userPatterns) {
			// ReDoS protection: reject patterns with nested quantifiers or backtracking risk
			if (/(\+|\*|\{)\s*\)(\+|\*|\{|\?)/.test(patternStr)) continue;
			if (/\(.*\|.*\)(\+|\*|\{)/.test(patternStr)) continue;
			try {
				const re = new RegExp(patternStr, "i");
				if (re.test(message)) return true;
			} catch {
				/* Invalid regex -- skip */
			}
		}
	}

	return false;
}
