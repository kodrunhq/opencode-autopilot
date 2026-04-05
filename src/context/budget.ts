import type { ContextSource } from "./types";

const CHARS_PER_TOKEN = 4;
const DEFAULT_TOTAL_BUDGET = 4000;
const TRUNCATION_SUFFIX = "... [truncated]";

export function truncateToTokens(content: string, maxTokens: number): string {
	const maxChars = Math.max(0, Math.floor(maxTokens * CHARS_PER_TOKEN));
	if (content.length <= maxChars) {
		return content;
	}

	if (maxChars === 0) {
		return "";
	}

	if (maxChars <= TRUNCATION_SUFFIX.length) {
		return TRUNCATION_SUFFIX.slice(0, maxChars);
	}

	const truncatedContent = content.slice(0, maxChars - TRUNCATION_SUFFIX.length).trimEnd();
	return `${truncatedContent}${TRUNCATION_SUFFIX}`;
}

export function allocateBudget(
	sources: readonly ContextSource[],
	totalBudget: number = DEFAULT_TOTAL_BUDGET,
): { readonly allocations: ReadonlyMap<string, number>; readonly totalUsed: number } {
	const orderedSources = [...sources].sort(
		(left, right) => right.priority - left.priority || left.filePath.localeCompare(right.filePath),
	);
	const allocations = new Map<string, number>();
	let remainingBudget = Math.max(0, totalBudget);

	for (const source of orderedSources) {
		const allocation = Math.min(source.tokenEstimate, remainingBudget);
		allocations.set(source.filePath, allocation);
		remainingBudget -= allocation;
	}

	return {
		allocations,
		totalUsed: Math.max(0, totalBudget) - remainingBudget,
	};
}
