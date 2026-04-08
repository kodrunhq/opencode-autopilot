import type { AutoRetrySignal, ErrorContentResult, ErrorType } from "./types";

export const RETRYABLE_ERROR_PATTERNS: readonly RegExp[] = Object.freeze([
	/rate.?limit/i,
	/too.?many.?requests/i,
	/quota.?exceeded/i,
	/quota.?protection/i,
	/quota\s+will\s+reset\s+after/i,
	/key.?limit.?exceeded/i,
	/usage\s+limit\s+has\s+been\s+reached/i,
	/reached\s+your\s+usage\s+limit/i,
	/all\s+credentials\s+for\s+model/i,
	/cool(?:ing)?\s+down/i,
	/exhausted\s+your\s+capacity/i,
	/service.?unavailable/i,
	/overloaded/i,
	/temporarily.?unavailable/i,
	/try.?again/i,
	/credit.*balance.*too.*low/i,
	/insufficient.?(?:credits?|funds?|balance)/i,
	/subscription.*quota/i,
	/billing.?(?:hard.?)?limit/i,
	/payment.?required/i,
	/out\s+of\s+credits?/i,
	/model.{0,20}?not.{0,10}?supported/i,
	/model_not_supported/i,
	/(?:^|\s)402(?:\s|$)/,
	/(?:^|\s)429(?:\s|$)/,
	/(?:^|\s)503(?:\s|$)/,
	/(?:^|\s)529(?:\s|$)/,
]);

const AUTO_RETRY_PATTERNS: readonly ((combined: string) => boolean)[] = Object.freeze([
	(combined: string) => /retrying\s+in/i.test(combined),
	(combined: string) =>
		/(?:too\s+many\s+requests|quota\s*exceeded|quota\s+will\s+reset\s+after|usage\s+limit|rate\s+limit|limit\s+reached|all\s+credentials\s+for\s+model|cool(?:ing)?\s*down|exhausted\s+your\s+capacity)/i.test(
			combined,
		),
]);

/**
 * Extracts a human-readable error message from an unknown error value.
 * Performs deep extraction checking error.data, error.error, error.data.error,
 * and error.cause paths for nested messages.
 */
export function getErrorMessage(error: unknown): string {
	if (error === null || error === undefined) return "";
	if (typeof error === "string") return error;

	if (typeof error !== "object") return "";

	const obj = error as Record<string, unknown>;

	const paths = [
		obj.data,
		obj.error,
		obj,
		(obj.data as Record<string, unknown> | undefined)?.error,
	];

	for (const candidate of paths) {
		if (candidate && typeof candidate === "object") {
			const msg = (candidate as Record<string, unknown>).message;
			if (typeof msg === "string" && msg.length > 0) return msg;
		}
	}

	if (typeof obj.error === "string") return obj.error;

	// "AI_LoadApiKeyError: API key missing" → extract after colon
	const name = obj.name;
	if (typeof name === "string" && name.length > 0) {
		const colonMatch = name.match(/:\s*(.+)/);
		if (colonMatch) return colonMatch[1].trim();
	}

	if (obj.cause && typeof obj.cause === "object") {
		const causeMsg = (obj.cause as Record<string, unknown>).message;
		if (typeof causeMsg === "string" && causeMsg.length > 0) return causeMsg;
	}

	try {
		return JSON.stringify(error);
	} catch {
		return "";
	}
}

/**
 * Extracts the error name from deeply nested error structures.
 * Checks error.name, error.data.name, error.error.name, and error.data.error.name.
 */
export function extractErrorName(error: unknown): string | undefined {
	if (!error || typeof error !== "object") return undefined;

	const obj = error as Record<string, unknown>;

	if (typeof obj.name === "string" && obj.name.length > 0) return obj.name;

	const dataName = (obj.data as Record<string, unknown> | undefined)?.name;
	if (typeof dataName === "string" && dataName.length > 0) return dataName;

	const nestedName = (obj.error as Record<string, unknown> | undefined)?.name;
	if (typeof nestedName === "string" && nestedName.length > 0) return nestedName;

	const dataErrorName = (
		(obj.data as Record<string, unknown> | undefined)?.error as Record<string, unknown> | undefined
	)?.name;
	if (typeof dataErrorName === "string" && dataErrorName.length > 0) return dataErrorName;

	return undefined;
}

/**
 * Extracts a status code from an error if it matches the retryable set.
 * Checks error.status, error.statusCode, error.data.statusCode, error.error.statusCode,
 * error.cause.statusCode, and message text patterns.
 */
export function extractStatusCode(error: unknown, retryOnErrors: readonly number[]): number | null {
	if (error !== null && typeof error === "object") {
		const obj = error as Record<string, unknown>;

		const candidates = [
			obj.statusCode,
			obj.status,
			(obj.data as Record<string, unknown> | undefined)?.statusCode,
			(obj.error as Record<string, unknown> | undefined)?.statusCode,
			(obj.cause as Record<string, unknown> | undefined)?.statusCode,
		];

		for (const code of candidates) {
			if (typeof code === "number" && retryOnErrors.includes(code)) return code;
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
 * Classifies an error into a known ErrorType category based on message patterns,
 * error names, and status codes.
 */
export function classifyErrorType(error: unknown): ErrorType {
	const message = getErrorMessage(error);
	const lowerMessage = message.toLowerCase();
	const errorName = extractErrorName(error)?.toLowerCase();

	if (error !== null && typeof error === "object") {
		const obj = error as Record<string, unknown>;
		if (obj.status === 429 || obj.statusCode === 429) return "rate_limit";
	}

	if (
		errorName?.includes("ai_loadapikeyerror") ||
		errorName?.includes("loadapi") ||
		(/api.?key/i.test(message) &&
			/missing|no\s|not\s+(?:provided|found|set|configured)/i.test(message)) ||
		(/api.?key.?is.?missing/i.test(message) && /environment variable/i.test(message))
	)
		return "missing_api_key";

	if (/api.?key/i.test(message) && /must be a string|invalid|malformed/i.test(message))
		return "invalid_api_key";

	if (
		errorName?.includes("providermodelnotfounderror") ||
		errorName?.includes("modelnotfounderror") ||
		errorName?.toLowerCase().includes("providermodelnotfound") ||
		(errorName?.includes("unknownerror") && /model\s+not\s+found/i.test(message)) ||
		/model.*not.*(?:found|exist)/i.test(message)
	)
		return "model_not_found";

	if (
		errorName?.includes("quotaexceeded") ||
		errorName?.includes("insufficientquota") ||
		errorName?.includes("billingerror") ||
		/quota.?exceeded/i.test(lowerMessage) ||
		/subscription.*quota/i.test(lowerMessage) ||
		/insufficient.?quota/i.test(lowerMessage) ||
		/billing.?(?:hard.?)?limit/i.test(lowerMessage) ||
		/exhausted\s+your\s+capacity/i.test(lowerMessage) ||
		/out\s+of\s+credits?/i.test(lowerMessage) ||
		/payment.?required/i.test(lowerMessage) ||
		/insufficient.?(?:credits?|funds?|balance)/i.test(lowerMessage)
	)
		return "quota_exceeded";

	if (/content.?filter/i.test(message)) return "content_filter";
	if (/context.?length/i.test(message)) return "context_length";
	if (/rate.?limit/i.test(lowerMessage) || /too.?many.?requests/i.test(lowerMessage))
		return "rate_limit";
	if (/service.?unavailable/i.test(lowerMessage) || /overloaded/i.test(lowerMessage))
		return "service_unavailable";

	return "unknown";
}

/**
 * Detects auto-retry signals in info objects (e.g. "retrying in 30s", "quota exceeded").
 * Used by the fallback system to detect when a model is temporarily throttled.
 */
export function extractAutoRetrySignal(
	info: Record<string, unknown> | undefined,
): AutoRetrySignal | undefined {
	if (!info) return undefined;

	const candidates: string[] = [];

	for (const key of ["status", "summary", "message", "details"] as const) {
		const value = info[key];
		if (typeof value === "string") candidates.push(value);
	}

	const combined = candidates.join("\n");
	if (!combined) return undefined;

	const isAutoRetry = AUTO_RETRY_PATTERNS.some((test) => test(combined));
	return isAutoRetry ? { signal: combined } : undefined;
}

/**
 * Checks if message parts contain error-type content.
 * Used to detect errors embedded in model response parts.
 */
export function containsErrorContent(
	parts: ReadonlyArray<{ type?: string; text?: string }> | undefined,
): ErrorContentResult {
	if (!parts || parts.length === 0) return { hasError: false };

	const errorParts = parts.filter((p) => p.type === "error");
	if (errorParts.length > 0) {
		const errorMessages = errorParts
			.map((p) => p.text)
			.filter((text): text is string => typeof text === "string");
		return {
			hasError: true,
			errorMessage: errorMessages.length > 0 ? errorMessages.join("\n") : undefined,
		};
	}

	return { hasError: false };
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

	if (
		errorType === "missing_api_key" ||
		errorType === "invalid_api_key" ||
		errorType === "model_not_found" ||
		errorType === "quota_exceeded"
	)
		return true;

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
