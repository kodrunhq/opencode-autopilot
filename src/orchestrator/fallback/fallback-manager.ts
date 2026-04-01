import { isRetryableError } from "./error-classifier";
import type { FallbackConfig } from "./fallback-config";
import {
	commitFallback,
	createFallbackState,
	planFallback,
	recoverToOriginal,
} from "./fallback-state";
import type { FallbackPlan, FallbackState } from "./types";

const SELF_ABORT_WINDOW_MS = 2000;

export interface FallbackManagerOptions {
	readonly config: FallbackConfig;
	readonly resolveFallbackChain: (sessionID: string, agentName?: string) => readonly string[];
}

/**
 * Encapsulates per-session fallback state and concurrency guards.
 * Delegates to pure functions from fallback-state/error-classifier modules.
 * Accepts SDK operations as callbacks to remain testable without the OpenCode runtime.
 */
export class FallbackManager {
	private readonly config: FallbackConfig;
	private readonly resolveFallbackChain: (
		sessionID: string,
		agentName?: string,
	) => readonly string[];

	// Per-session tracking (all private)
	private readonly sessionStates: Map<string, FallbackState> = new Map();
	private readonly sessionRetryInFlight: Set<string> = new Set();
	private readonly sessionAwaitingFallbackResult: Set<string> = new Set();
	private readonly sessionSelfAbortTimestamp: Map<string, number> = new Map();
	private readonly sessionFirstTokenReceived: Map<string, boolean> = new Map();
	private readonly sessionFallbackTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
	private readonly sessionParentID: Map<string, string | null> = new Map();
	private readonly sessionCompactionInFlight: Set<string> = new Set();

	constructor(options: FallbackManagerOptions) {
		this.config = options.config;
		this.resolveFallbackChain = options.resolveFallbackChain;
	}

	/**
	 * Creates fallback state for a session with the given model.
	 */
	initSession(sessionID: string, model: string, parentID?: string | null): void {
		this.sessionStates.set(sessionID, createFallbackState(model));
		if (parentID !== undefined) {
			this.sessionParentID.set(sessionID, parentID);
		}
	}

	/**
	 * Returns FallbackState for known session, undefined for unknown.
	 */
	getSessionState(sessionID: string): FallbackState | undefined {
		return this.sessionStates.get(sessionID);
	}

	/**
	 * Removes all tracking state for a session. Safe to call on unknown sessions.
	 */
	cleanupSession(sessionID: string): void {
		this.sessionStates.delete(sessionID);
		this.sessionRetryInFlight.delete(sessionID);
		this.sessionAwaitingFallbackResult.delete(sessionID);
		this.sessionSelfAbortTimestamp.delete(sessionID);
		this.sessionFirstTokenReceived.delete(sessionID);
		this.sessionParentID.delete(sessionID);
		this.sessionCompactionInFlight.delete(sessionID);

		// Clear TTFT timeout if present
		const timer = this.sessionFallbackTimeouts.get(sessionID);
		if (timer !== undefined) {
			clearTimeout(timer);
			this.sessionFallbackTimeouts.delete(sessionID);
		}
	}

	/**
	 * Acquires the per-session retry lock. Returns true on first call, false if already held.
	 * Prevents dual event handler race (Pitfall 1).
	 */
	acquireRetryLock(sessionID: string): boolean {
		if (this.sessionRetryInFlight.has(sessionID)) {
			return false;
		}
		this.sessionRetryInFlight.add(sessionID);
		return true;
	}

	/**
	 * Releases the per-session retry lock.
	 */
	releaseRetryLock(sessionID: string): void {
		this.sessionRetryInFlight.delete(sessionID);
	}

	/**
	 * Returns true if a retry dispatch or fallback result is pending for the session.
	 */
	isDispatchInFlight(sessionID: string): boolean {
		return (
			this.sessionRetryInFlight.has(sessionID) || this.sessionAwaitingFallbackResult.has(sessionID)
		);
	}

	/**
	 * Marks a session as awaiting a fallback result (replay dispatched, not yet complete).
	 */
	markAwaitingResult(sessionID: string): void {
		this.sessionAwaitingFallbackResult.add(sessionID);
	}

	/**
	 * Clears the awaiting-result flag for a session.
	 */
	clearAwaitingResult(sessionID: string): void {
		this.sessionAwaitingFallbackResult.delete(sessionID);
	}

	/**
	 * Records a self-abort timestamp for self-abort suppression (Pitfall 2).
	 */
	recordSelfAbort(sessionID: string): void {
		this.sessionSelfAbortTimestamp.set(sessionID, Date.now());
	}

	/**
	 * Returns true when a MessageAbortedError arrives within 2000ms of recordSelfAbort.
	 * Suppresses self-inflicted abort errors (Pitfall 2).
	 */
	isSelfAbortError(sessionID: string): boolean {
		const timestamp = this.sessionSelfAbortTimestamp.get(sessionID);
		if (timestamp === undefined) {
			return false;
		}
		if (Date.now() - timestamp < SELF_ABORT_WINDOW_MS) {
			return true;
		}
		this.sessionSelfAbortTimestamp.delete(sessionID);
		return false;
	}

	/**
	 * Returns true when error model is in failedModels and differs from currentModel.
	 * Suppresses stale error events from previous models (Pitfall 5).
	 */
	isStaleError(sessionID: string, errorModel?: string): boolean {
		const state = this.sessionStates.get(sessionID);
		if (!state || !errorModel) {
			return false;
		}
		return errorModel !== state.currentModel && state.failedModels.has(errorModel);
	}

	/**
	 * Creates a TTFT timer that calls the provided callback after timeoutSeconds.
	 * Replaces any existing timeout for the session.
	 */
	startTtftTimeout(sessionID: string, onTimeout: () => void): void {
		// Clear existing timeout if any
		const existingTimer = this.sessionFallbackTimeouts.get(sessionID);
		if (existingTimer !== undefined) {
			clearTimeout(existingTimer);
		}

		this.sessionFirstTokenReceived.set(sessionID, false);

		const timer = setTimeout(onTimeout, this.config.timeoutSeconds * 1000);
		this.sessionFallbackTimeouts.set(sessionID, timer);
	}

	/**
	 * Records that the first token was received for a session. Cancels the TTFT timer.
	 */
	recordFirstToken(sessionID: string): void {
		if (this.sessionFirstTokenReceived.get(sessionID) === false) {
			this.sessionFirstTokenReceived.set(sessionID, true);
			const timer = this.sessionFallbackTimeouts.get(sessionID);
			if (timer !== undefined) {
				clearTimeout(timer);
				this.sessionFallbackTimeouts.delete(sessionID);
			}
		}
	}

	/**
	 * Handles an error for a session. Orchestrates guard checks and returns a FallbackPlan
	 * if fallback should proceed, or null if the error should be suppressed/ignored.
	 *
	 * Guard order:
	 * 1. Self-abort suppression (Pitfall 2)
	 * 2. Stale error suppression (Pitfall 5)
	 * 3. Retryable error check
	 * 4. Retry lock (Pitfall 1)
	 * 5. Session state existence
	 * 6. Plan fallback via pure function
	 */
	handleError(sessionID: string, error: unknown, errorModel?: string): FallbackPlan | null {
		// Pitfall 2: Suppress self-abort errors
		if (this.isSelfAbortError(sessionID)) {
			return null;
		}

		// Pitfall 5: Suppress stale errors from previous models
		if (this.isStaleError(sessionID, errorModel)) {
			return null;
		}

		// Check if error is retryable
		if (!isRetryableError(error, this.config.retryOnErrors, this.config.retryableErrorPatterns)) {
			return null;
		}

		// Pitfall 1: Only one handler plans+dispatches per session
		if (!this.acquireRetryLock(sessionID)) {
			return null;
		}

		// Check session state
		const state = this.sessionStates.get(sessionID);
		if (!state) {
			this.releaseRetryLock(sessionID);
			return null;
		}

		// Plan fallback via pure function
		const chain = this.resolveFallbackChain(sessionID);
		const result = planFallback(
			state,
			chain,
			this.config.maxFallbackAttempts,
			this.config.cooldownSeconds * 1000,
		);

		if (!result.success) {
			this.releaseRetryLock(sessionID);
			return null;
		}

		// Return plan (caller commits after successful dispatch)
		return result.plan;
	}

	/**
	 * Applies a fallback plan to session state immutably.
	 * Returns true if the plan was committed, false if stale or session unknown.
	 */
	commitAndUpdateState(sessionID: string, plan: FallbackPlan): boolean {
		const state = this.sessionStates.get(sessionID);
		if (!state) {
			return false;
		}

		const result = commitFallback(state, plan);
		if (result.committed) {
			this.sessionStates.set(sessionID, result.state);
		}
		return result.committed;
	}

	/**
	 * Attempts to recover to the original model after cooldown expires.
	 * Returns true if recovery succeeded, false otherwise.
	 */
	tryRecoverToOriginal(sessionID: string): boolean {
		const state = this.sessionStates.get(sessionID);
		if (!state) {
			return false;
		}

		const recovered = recoverToOriginal(state, this.config.cooldownSeconds * 1000);
		if (recovered) {
			this.sessionStates.set(sessionID, recovered);
			return true;
		}
		return false;
	}

	/**
	 * Marks a session as having compaction in flight.
	 */
	markCompactionInFlight(sessionID: string): void {
		this.sessionCompactionInFlight.add(sessionID);
	}

	/**
	 * Clears the compaction-in-flight flag for a session.
	 */
	clearCompactionInFlight(sessionID: string): void {
		this.sessionCompactionInFlight.delete(sessionID);
	}

	/**
	 * Returns true if compaction is in flight for a session.
	 */
	isCompactionInFlight(sessionID: string): boolean {
		return this.sessionCompactionInFlight.has(sessionID);
	}

	/**
	 * Returns the parent session ID for a child session, or undefined if not tracked.
	 */
	getParentID(sessionID: string): string | null | undefined {
		return this.sessionParentID.get(sessionID);
	}
}
