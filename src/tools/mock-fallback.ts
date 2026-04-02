import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { createMockError } from "../observability/mock/mock-provider";
import type { MockFailureMode } from "../observability/mock/types";
import { FAILURE_MODES } from "../observability/mock/types";
import { classifyErrorType, isRetryableError } from "../orchestrator/fallback/error-classifier";

/**
 * Default retryable status codes matching the standard fallback config.
 */
const DEFAULT_RETRY_CODES: readonly number[] = Object.freeze([429, 503, 529]);

/**
 * Human-readable descriptions for each failure mode.
 */
const MODE_DESCRIPTIONS: Readonly<Record<MockFailureMode, string>> = Object.freeze({
	rate_limit: "Simulates HTTP 429 rate limit response",
	quota_exceeded: "Simulates HTTP 402 quota/billing error",
	timeout: "Simulates HTTP 504 gateway timeout (classifies as service_unavailable)",
	malformed: "Simulates unparseable/corrupt response (not retryable)",
	service_unavailable: "Simulates HTTP 503 service outage",
});

/**
 * Core function for mock fallback testing tool.
 * Follows the *Core + tool() wrapper pattern per CLAUDE.md.
 *
 * - "list" mode returns all available failure modes with descriptions
 * - Any valid failure mode generates and classifies the mock error
 * - Invalid modes return an error JSON
 *
 * This tool does NOT trigger fallback in a live session. It generates and
 * classifies errors, showing what the fallback system would see.
 */
export async function mockFallbackCore(mode: string): Promise<string> {
	if (mode === "list") {
		const modeLines = FAILURE_MODES.map((m) => `  ${m}: ${MODE_DESCRIPTIONS[m]}`).join("\n");

		return JSON.stringify({
			action: "mock_fallback_list",
			modes: [...FAILURE_MODES],
			displayText: `Available failure modes:\n${modeLines}`,
		});
	}

	// Validate mode
	if (!FAILURE_MODES.includes(mode as MockFailureMode)) {
		return JSON.stringify({
			action: "error",
			message: "Invalid failure mode. Use 'list' to see available modes.",
		});
	}

	const failureMode = mode as MockFailureMode;
	const error = createMockError(failureMode);
	const classification = classifyErrorType(error);
	const retryable = isRetryableError(error, DEFAULT_RETRY_CODES);

	// Extract error fields for the response
	const errorObj = error as Record<string, unknown>;
	const errorSummary: Record<string, unknown> = {
		name: errorObj.name,
		message: errorObj.message,
	};
	if (errorObj.status !== undefined) {
		errorSummary.status = errorObj.status;
	}

	const displayText = [
		`Mock ${failureMode} error generated.`,
		`Classification: ${classification}`,
		`Retryable: ${retryable}`,
		"",
		"To test fallback chain: inject this error into FallbackManager.handleError() in a test,",
		"or use oc_mock_fallback in a session to verify error classification behavior.",
	].join("\n");

	return JSON.stringify({
		action: "mock_fallback",
		mode: failureMode,
		error: errorSummary,
		classification,
		retryable,
		displayText,
	});
}

// --- Tool wrapper ---

export const ocMockFallback = tool({
	description:
		"Generate mock errors for fallback chain testing. " +
		"Use 'list' to see available failure modes.",
	args: {
		mode: z.string().describe("Failure mode to simulate or 'list' for available modes"),
	},
	async execute({ mode }) {
		return mockFallbackCore(mode);
	},
});
