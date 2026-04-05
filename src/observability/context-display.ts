export function getContextUtilizationString(usedTokens: number, maxTokens: number): string {
	const safeMaxTokens = Math.max(0, maxTokens);
	const safeUsedTokens = Math.max(0, usedTokens);
	const utilization =
		safeMaxTokens > 0 ? Math.min(100, Math.round((safeUsedTokens / safeMaxTokens) * 100)) : 0;

	return `[${utilization}% used] ${safeUsedTokens} / ${safeMaxTokens} tokens`;
}
