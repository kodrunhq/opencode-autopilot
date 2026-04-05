const REMEDIATION_HINTS = Object.freeze([
	{
		pattern: /429|rate limit/i,
		hint: "Rate limited. Will retry in 30s.",
	},
	{
		pattern: /context window|token limit/i,
		hint: "Context window exceeded. Try compacting conversation.",
	},
	{
		pattern: /auth|unauthorized/i,
		hint: "Authentication failed. Check your API key.",
	},
	{
		pattern: /timeout/i,
		hint: "Request timed out. Will retry with longer timeout.",
	},
	{
		pattern: /empty content/i,
		hint: "Model returned empty response. Retrying with different model.",
	},
	{
		pattern: /SQLITE_BUSY/i,
		hint: "Database busy. Retrying with backoff.",
	},
]);

export function getRemediationHint(error: Error | string): string | null {
	const message = typeof error === "string" ? error : error.message;

	for (const entry of REMEDIATION_HINTS) {
		if (entry.pattern.test(message)) {
			return entry.hint;
		}
	}

	return null;
}
