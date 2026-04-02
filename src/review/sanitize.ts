/**
 * Strip {{PLACEHOLDER}} tokens from untrusted content before template substitution.
 * Prevents template injection where diff content or prior findings could contain
 * {{PRIOR_FINDINGS}} or similar tokens that get substituted in a subsequent .replace() call.
 */
export function sanitizeTemplateContent(content: string): string {
	return content.replace(/\{\{[\w]+\}\}/gi, "[REDACTED]");
}
