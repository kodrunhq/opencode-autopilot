/**
 * Token accumulation utilities for session observability.
 *
 * Pure functions that accumulate token/cost data from AssistantMessage shapes.
 * Returns new objects (immutable, per CLAUDE.md) -- never mutates inputs.
 *
 * @module
 */

/**
 * Aggregated token and cost data for a session.
 */
export interface TokenAggregate {
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly reasoningTokens: number;
	readonly cacheReadTokens: number;
	readonly cacheWriteTokens: number;
	readonly totalCost: number;
	readonly messageCount: number;
}

/**
 * Returns a zero-initialized TokenAggregate.
 */
export function createEmptyTokenAggregate(): TokenAggregate {
	return Object.freeze({
		inputTokens: 0,
		outputTokens: 0,
		reasoningTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		totalCost: 0,
		messageCount: 0,
	});
}

/**
 * Accumulates token/cost data into a new TokenAggregate.
 * Missing fields in `incoming` default to 0.
 * Returns a new frozen object (immutable).
 *
 * @param current - The current aggregate to add onto
 * @param incoming - Partial aggregate with fields to add
 */
export function accumulateTokens(
	current: TokenAggregate,
	incoming: Partial<TokenAggregate>,
): TokenAggregate {
	return Object.freeze({
		inputTokens: current.inputTokens + (incoming.inputTokens ?? 0),
		outputTokens: current.outputTokens + (incoming.outputTokens ?? 0),
		reasoningTokens: current.reasoningTokens + (incoming.reasoningTokens ?? 0),
		cacheReadTokens: current.cacheReadTokens + (incoming.cacheReadTokens ?? 0),
		cacheWriteTokens: current.cacheWriteTokens + (incoming.cacheWriteTokens ?? 0),
		totalCost: current.totalCost + (incoming.totalCost ?? 0),
		messageCount: current.messageCount + (incoming.messageCount ?? 0),
	});
}

/**
 * Shape of token data within an AssistantMessage from the OpenCode SDK.
 */
export interface AssistantMessageTokens {
	readonly tokens: {
		readonly input: number;
		readonly output: number;
		readonly reasoning: number;
		readonly cache: {
			readonly read: number;
			readonly write: number;
		};
	};
	readonly cost: number;
}

/**
 * Extracts token/cost data from an AssistantMessage shape and accumulates
 * it into a new TokenAggregate. Increments messageCount by 1.
 *
 * @param current - The current aggregate to add onto
 * @param msg - The AssistantMessage-shaped object with tokens and cost
 */
export function accumulateTokensFromMessage(
	current: TokenAggregate,
	msg: AssistantMessageTokens,
): TokenAggregate {
	return accumulateTokens(current, {
		inputTokens: msg.tokens.input ?? 0,
		outputTokens: msg.tokens.output ?? 0,
		reasoningTokens: msg.tokens.reasoning ?? 0,
		cacheReadTokens: msg.tokens.cache.read ?? 0,
		cacheWriteTokens: msg.tokens.cache.write ?? 0,
		totalCost: msg.cost ?? 0,
		messageCount: 1,
	});
}
