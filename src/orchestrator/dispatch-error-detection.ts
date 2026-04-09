/**
 * Dispatch error detection patterns and utilities.
 *
 * Extracted from dispatch-retry.ts for line count management.
 * See dispatch-retry.ts for integration with retry decision logic.
 */

/** Regex patterns matching provider/transport errors embedded in result text. */
export const DISPATCH_ERROR_PATTERNS: readonly RegExp[] = Object.freeze([
	/\bprovider_unavailable\b/i,
	/\b(?:502|503|504)\b.*(?:bad\s+gateway|service\s+unavailable|gateway\s+timeout)/i,
	/\bnetwork\s+connection\s+lost\b/i,
	/\brate\s*limit/i,
	/\btoo\s+many\s+requests\b/i,
	/\b429\b/,
	/\btimeout\b/i,
	/\btimed?\s*out\b/i,
	/\bECONNRESET\b/i,
	/\bsocket\s+hang\s+up\b/i,
	/\bservice\s+unavailable\b/i,
	/\boverloaded\b/i,
	/\bE_INVALID_RESULT\b/,
	/\btool\s+execution\s+aborted\b/i,
	/\binternal\s+server\s+error\b/i,
]);

/** Results shorter than this with an error pattern are almost certainly failures. */
export const MIN_MEANINGFUL_RESULT_LENGTH = 120;

/**
 * Detect whether a result payload indicates a dispatch failure.
 * Returns the extracted error string if detected, null otherwise.
 */
export function detectDispatchFailure(resultText: string): string | null {
	if (!resultText || resultText.trim().length === 0) {
		return "empty result payload";
	}

	const trimmed = resultText.trim();

	// Try parsing as JSON — handles both single-line and multiline JSON error payloads
	try {
		const parsed = JSON.parse(trimmed) as Record<string, unknown>;
		if (parsed.error || parsed.code || parsed.status === "error") {
			const errorMsg =
				typeof parsed.error === "string"
					? parsed.error
					: typeof parsed.message === "string"
						? parsed.message
						: typeof parsed.code === "string"
							? parsed.code
							: JSON.stringify(parsed);
			return errorMsg;
		}
	} catch {
		// Not clean JSON — check if a JSON error is embedded within larger text
		const jsonMatch = trimmed.match(/\{[^{}]*"(?:error|code|status)"[^{}]*\}/);
		if (jsonMatch) {
			try {
				const embedded = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
				if (embedded.error || embedded.code || embedded.status === "error") {
					const errorMsg =
						typeof embedded.error === "string"
							? embedded.error
							: typeof embedded.message === "string"
								? embedded.message
								: typeof embedded.code === "string"
									? embedded.code
									: jsonMatch[0];
					return errorMsg;
				}
			} catch {
				// embedded JSON parse failed — fall through
			}
		}
	}

	if (trimmed.length < MIN_MEANINGFUL_RESULT_LENGTH) {
		for (const pattern of DISPATCH_ERROR_PATTERNS) {
			if (pattern.test(trimmed)) {
				return trimmed;
			}
		}
	}

	// Check first line for error patterns — only flag if total output is short
	// (indicating the agent never produced real output after the error)
	const firstLine = trimmed.split("\n")[0] ?? "";
	if (firstLine.length < 200) {
		for (const pattern of DISPATCH_ERROR_PATTERNS) {
			if (pattern.test(firstLine) && trimmed.length < MIN_MEANINGFUL_RESULT_LENGTH * 4) {
				return firstLine;
			}
		}
	}

	return null;
}
