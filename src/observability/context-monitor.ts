/**
 * Context utilization tracking with one-time warning per session.
 *
 * Pure function `checkContextUtilization` computes utilization ratio and warning signal.
 * `ContextMonitor` class tracks per-session warned state and context limits.
 *
 * The toast itself is NOT fired here -- that happens in the event handler
 * (separation of concerns). This module only computes whether to warn.
 *
 * @module
 */

/** Threshold at which context utilization triggers a warning (80%). */
const CONTEXT_WARNING_THRESHOLD = 0.8;

/**
 * Result of a context utilization check.
 */
export interface ContextUtilizationResult {
	readonly utilization: number;
	readonly shouldWarn: boolean;
}

/**
 * Pure function that computes context utilization and whether to warn.
 *
 * - Returns utilization as a ratio (0.0 - 1.0)
 * - Returns shouldWarn=true when utilization >= 0.80 and not already warned
 * - Returns shouldWarn=false when already warned (fires once per D-36)
 * - Handles zero contextLimit gracefully (returns 0 utilization)
 *
 * @param latestInputTokens - Current cumulative input tokens for the session
 * @param contextLimit - The model's context window size in tokens
 * @param alreadyWarned - Whether this session has already been warned
 */
export function checkContextUtilization(
	latestInputTokens: number,
	contextLimit: number,
	alreadyWarned: boolean,
): ContextUtilizationResult {
	if (contextLimit <= 0) {
		return { utilization: 0, shouldWarn: false };
	}

	const utilization = latestInputTokens / contextLimit;
	const shouldWarn = !alreadyWarned && utilization >= CONTEXT_WARNING_THRESHOLD;

	return { utilization, shouldWarn };
}

/**
 * Per-session state for context monitoring.
 */
interface SessionContextState {
	readonly contextLimit: number;
	warned: boolean;
}

/**
 * Tracks context utilization per session with one-time warning.
 *
 * - `initSession` sets the context limit for a session
 * - `processMessage` checks utilization and updates warned state
 * - `cleanup` removes session tracking data
 */
export class ContextMonitor {
	private readonly sessions: Map<string, SessionContextState> = new Map();

	/**
	 * Initializes tracking for a session with its model's context limit.
	 */
	initSession(sessionID: string, contextLimit: number): void {
		this.sessions.set(sessionID, { contextLimit, warned: false });
	}

	/**
	 * Checks context utilization for a session and updates warned state.
	 * Returns utilization 0 for unknown sessions.
	 */
	processMessage(sessionID: string, inputTokens: number): ContextUtilizationResult {
		const state = this.sessions.get(sessionID);
		if (!state) {
			return { utilization: 0, shouldWarn: false };
		}

		const result = checkContextUtilization(inputTokens, state.contextLimit, state.warned);

		// Update warned flag if warning triggered (one-time per session)
		if (result.shouldWarn) {
			this.sessions.set(sessionID, { ...state, warned: true });
		}

		return result;
	}

	/**
	 * Removes session tracking data.
	 */
	cleanup(sessionID: string): void {
		this.sessions.delete(sessionID);
	}
}
