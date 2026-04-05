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
	{
		pattern: /ENOENT|no such file/i,
		hint: "File not found. Check that the file path exists and is accessible.",
	},
	{
		pattern: /EACCES|permission denied/i,
		hint: "Permission denied. Check file/directory permissions.",
	},
	{
		pattern: /ECONNREFUSED|ECONNRESET|EPIPE/i,
		hint: "Connection failed. Check network connectivity and service availability.",
	},
	{
		pattern: /JSON\.parse|Unexpected token|invalid json/i,
		hint: "Invalid JSON in response. Model may have returned malformed output — retrying.",
	},
	{
		pattern: /result envelope|schemaVersion|resultId/i,
		hint: "Agent returned invalid result envelope. Check that the agent wraps output in the typed envelope format.",
	},
	{
		pattern: /phase transition|invalid.*transition/i,
		hint: "Invalid phase transition. The pipeline state machine rejected this move — check current phase with oc_state.",
	},
	{
		pattern: /strike|CRITICAL.*finding|3.*strike/i,
		hint: "Build phase hit strike limit. Review the CRITICAL findings and fix before retrying.",
	},
	{
		pattern: /no.*tasks|task.*list.*empty/i,
		hint: "No tasks found in plan. The PLAN phase may not have generated tasks — check with oc_plan.",
	},
	{
		pattern: /fallback.*chain.*exhausted|no.*fallback/i,
		hint: "All fallback models exhausted. Configure additional fallbacks via oc_configure.",
	},
	{
		pattern: /model.*not.*found|unknown.*model/i,
		hint: "Model not available. Check model ID spelling or run oc_configure to reassign.",
	},
	{
		pattern: /slot.*full|no.*slot|max.*concurrent/i,
		hint: "All background task slots are occupied. Wait for running tasks to complete or increase maxSlots in config.",
	},
	{
		pattern: /dependency.*not.*met|blocked.*task/i,
		hint: "Task dependencies not satisfied. Check dependency graph with oc_background.",
	},
]);

const PHASE_HINTS: Readonly<Record<string, string>> = Object.freeze({
	RECON:
		"RECON phase failed. Try narrowing the research scope or providing more context about the domain.",
	CHALLENGE:
		"CHALLENGE phase failed. The idea enhancement step encountered issues — proceed with the original idea via skipPhase.",
	ARCHITECT:
		"ARCHITECT phase failed. Architecture proposals could not be generated — try providing clearer requirements.",
	EXPLORE:
		"EXPLORE phase failed. This phase is reserved for future use — it can safely be skipped.",
	PLAN: "PLAN phase failed. Task decomposition encountered issues — check that the architecture document is well-formed.",
	BUILD:
		"BUILD phase failed. Implementation hit errors — check test output and review findings for details.",
	SHIP: "SHIP phase failed. Documentation/changelog generation encountered issues — check for file write permissions.",
	RETROSPECTIVE:
		"RETROSPECTIVE phase failed. Lesson extraction encountered issues — this is non-critical, the pipeline output is still valid.",
});

export function getRemediationHint(error: Error | string, phase?: string): string | null {
	const message = typeof error === "string" ? error : error.message;

	for (const entry of REMEDIATION_HINTS) {
		if (entry.pattern.test(message)) {
			return entry.hint;
		}
	}

	if (phase && phase in PHASE_HINTS) {
		return PHASE_HINTS[phase];
	}

	return null;
}
