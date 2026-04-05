import { ErrorCategorySchema } from "../types/recovery";
import type { ClassificationResult, ExtendedErrorCategory } from "./types";

const CLASSIFICATION_RULES: readonly {
	readonly category: ExtendedErrorCategory;
	readonly patterns: readonly RegExp[];
	readonly confidence: number;
	readonly reasoning: string;
}[] = Object.freeze([
	{
		category: "empty_content",
		patterns: [/empty\s+content/i, /no\s+content/i, /empty\s+response/i],
		confidence: 0.98,
		reasoning: "Matched empty response pattern",
	},
	{
		category: "thinking_block_error",
		patterns: [/thinking\s+block/i, /reasoning\s+failed/i],
		confidence: 0.97,
		reasoning: "Matched reasoning failure pattern",
	},
	{
		category: "tool_result_overflow",
		patterns: [/result\s+too\s+large/i, /output\s+exceeded/i, /overflow/i],
		confidence: 0.97,
		reasoning: "Matched oversized tool output pattern",
	},
	{
		category: "context_window_exceeded",
		patterns: [/context\s+window/i, /token\s+limit/i, /max\s+tokens/i, /context\s+length/i],
		confidence: 0.98,
		reasoning: "Matched context exhaustion pattern",
	},
	{
		category: "session_corruption",
		patterns: [/session\s+corrupt/i, /invalid\s+state/i, /state\s+mismatch/i],
		confidence: 0.99,
		reasoning: "Matched session state corruption pattern",
	},
	{
		category: "agent_loop_stuck",
		patterns: [/loop\s+detected/i, /infinite\s+loop/i, /stuck/i, /no\s+progress/i],
		confidence: 0.95,
		reasoning: "Matched agent loop or no-progress pattern",
	},
	{
		category: "rate_limit",
		patterns: [/rate\s*limit/i, /too\s+many\s+requests/i, /\b429\b/],
		confidence: 0.96,
		reasoning: "Matched rate limit pattern",
	},
	{
		category: "auth_failure",
		patterns: [/auth/i, /unauthori[sz]ed/i, /forbidden/i, /api\s*key/i, /credential/i],
		confidence: 0.94,
		reasoning: "Matched authentication or authorization pattern",
	},
	{
		category: "quota_exceeded",
		patterns: [/quota/i, /credit\s+balance/i, /insufficient\s+(credits?|funds?|balance)/i],
		confidence: 0.96,
		reasoning: "Matched quota exhaustion pattern",
	},
	{
		category: "service_unavailable",
		patterns: [/service\s+unavailable/i, /temporarily\s+unavailable/i, /overloaded/i, /\b503\b/],
		confidence: 0.95,
		reasoning: "Matched service availability pattern",
	},
	{
		category: "timeout",
		patterns: [/timeout/i, /timed\s+out/i, /deadline\s+exceeded/i],
		confidence: 0.94,
		reasoning: "Matched timeout pattern",
	},
	{
		category: "network",
		patterns: [/network/i, /connection\s+reset/i, /socket\s+hang\s+up/i, /econnreset/i],
		confidence: 0.93,
		reasoning: "Matched network transport pattern",
	},
	{
		category: "validation",
		patterns: [/validation/i, /invalid\s+request/i, /malformed/i, /schema/i],
		confidence: 0.92,
		reasoning: "Matched validation pattern",
	},
]);

const NON_RECOVERABLE_CATEGORIES = new Set<ExtendedErrorCategory>([
	"auth_failure",
	"session_corruption",
]);

function getErrorMessage(error: Error | string): string {
	return typeof error === "string" ? error : error.message;
}

function isKnownBaseCategory(category: string): category is ExtendedErrorCategory {
	return ErrorCategorySchema.safeParse(category).success;
}

export function classifyError(
	error: Error | string,
	context?: Record<string, unknown>,
): ClassificationResult {
	const message = getErrorMessage(error);
	const contextText = context ? JSON.stringify(context) : "";
	const haystack = `${message}\n${contextText}`;

	for (const rule of CLASSIFICATION_RULES) {
		if (rule.patterns.some((pattern) => pattern.test(haystack))) {
			return Object.freeze({
				category: rule.category,
				confidence: rule.confidence,
				reasoning: rule.reasoning,
				isRecoverable: !NON_RECOVERABLE_CATEGORIES.has(rule.category),
			});
		}
	}

	const category: ExtendedErrorCategory = isKnownBaseCategory("unknown") ? "unknown" : "validation";
	return Object.freeze({
		category,
		confidence: 0.35,
		reasoning: "No known recovery pattern matched",
		isRecoverable: !NON_RECOVERABLE_CATEGORIES.has(category),
	});
}
