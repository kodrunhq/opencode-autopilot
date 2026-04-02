/**
 * In-memory session event store for observability data.
 *
 * Accumulates events, tokens, and tool metrics per session.
 * Data is flushed to disk by the event handler layer on session end.
 *
 * @module
 */

import type { TokenAggregate } from "./token-tracker";
import { accumulateTokens, createEmptyTokenAggregate } from "./token-tracker";

/**
 * Unified event type for the in-memory store.
 * Extends the Plan 01 SessionEvent types with additional observability events.
 */
export type ObservabilityEvent =
	| {
			readonly type: "fallback";
			readonly timestamp: string;
			readonly sessionID: string;
			readonly failedModel: string;
			readonly nextModel: string;
			readonly errorType: string;
			readonly success: boolean;
	  }
	| {
			readonly type: "error";
			readonly timestamp: string;
			readonly sessionID: string;
			readonly errorType: string;
			readonly message: string;
			readonly model?: string;
			readonly retryable: boolean;
	  }
	| {
			readonly type: "decision";
			readonly timestamp: string;
			readonly sessionID: string;
			readonly phase: string;
			readonly agent: string;
			readonly decision: string;
			readonly rationale: string;
			readonly confidence: string;
	  }
	| {
			readonly type: "model_switch";
			readonly timestamp: string;
			readonly sessionID: string;
			readonly fromModel: string;
			readonly toModel: string;
			readonly reason: string;
	  }
	| {
			readonly type: "context_warning";
			readonly timestamp: string;
			readonly sessionID: string;
			readonly utilization: number;
			readonly contextLimit: number;
			readonly inputTokens: number;
	  }
	| {
			readonly type: "tool_complete";
			readonly timestamp: string;
			readonly sessionID: string;
			readonly tool: string;
			readonly durationMs: number;
			readonly success: boolean;
	  }
	| {
			readonly type: "phase_transition";
			readonly timestamp: string;
			readonly sessionID: string;
			readonly fromPhase: string;
			readonly toPhase: string;
			readonly confidence?: string;
	  }
	| { readonly type: "session_start"; readonly timestamp: string; readonly sessionID: string }
	| {
			readonly type: "session_end";
			readonly timestamp: string;
			readonly sessionID: string;
			readonly durationMs: number;
			readonly totalCost: number;
	  };

/**
 * Per-tool execution metrics accumulated during a session.
 */
export interface ToolMetrics {
	readonly invocations: number;
	readonly totalDurationMs: number;
	readonly successes: number;
	readonly failures: number;
}

/**
 * All collected data for a single session.
 */
export interface SessionEvents {
	readonly sessionID: string;
	readonly events: readonly ObservabilityEvent[];
	readonly tokens: TokenAggregate;
	readonly toolMetrics: ReadonlyMap<string, ToolMetrics>;
	readonly currentPhase: string | null;
	readonly startedAt: string;
}

/**
 * Mutable internal state for a session (used within the store only).
 */
interface MutableSessionData {
	sessionID: string;
	events: ObservabilityEvent[];
	tokens: TokenAggregate;
	toolMetrics: Map<string, ToolMetrics>;
	currentPhase: string | null;
	startedAt: string;
}

/**
 * In-memory store for session observability events.
 * Accumulates events, tokens, and tool metrics per session.
 */
export class SessionEventStore {
	private readonly sessions: Map<string, MutableSessionData> = new Map();

	/**
	 * Initializes a new session in the store.
	 */
	initSession(sessionID: string): void {
		this.sessions.set(sessionID, {
			sessionID,
			events: [],
			tokens: createEmptyTokenAggregate(),
			toolMetrics: new Map(),
			currentPhase: null,
			startedAt: new Date().toISOString(),
		});
	}

	/**
	 * Appends an event to a session. Creates session if not yet initialized.
	 */
	appendEvent(sessionID: string, event: ObservabilityEvent): void {
		const session = this.sessions.get(sessionID);
		if (!session) return;
		session.events.push(event);
	}

	/**
	 * Accumulates token data for a session.
	 */
	accumulateTokens(sessionID: string, tokens: Partial<TokenAggregate>): void {
		const session = this.sessions.get(sessionID);
		if (!session) return;
		session.tokens = accumulateTokens(session.tokens, tokens);
	}

	/**
	 * Records a tool execution metric.
	 */
	recordToolExecution(sessionID: string, tool: string, durationMs: number, success: boolean): void {
		const session = this.sessions.get(sessionID);
		if (!session) return;

		const existing = session.toolMetrics.get(tool);
		const updated: ToolMetrics = {
			invocations: (existing?.invocations ?? 0) + 1,
			totalDurationMs: (existing?.totalDurationMs ?? 0) + durationMs,
			successes: (existing?.successes ?? 0) + (success ? 1 : 0),
			failures: (existing?.failures ?? 0) + (success ? 0 : 1),
		};
		session.toolMetrics.set(tool, updated);
	}

	/**
	 * Sets the current pipeline phase for a session.
	 */
	setCurrentPhase(sessionID: string, phase: string): void {
		const session = this.sessions.get(sessionID);
		if (!session) return;
		session.currentPhase = phase;
	}

	/**
	 * Gets the current pipeline phase for a session.
	 */
	getCurrentPhase(sessionID: string): string | null {
		return this.sessions.get(sessionID)?.currentPhase ?? null;
	}

	/**
	 * Returns a snapshot of session data without removing it.
	 */
	getSession(sessionID: string): SessionEvents | undefined {
		const session = this.sessions.get(sessionID);
		if (!session) return undefined;

		return {
			sessionID: session.sessionID,
			events: [...session.events],
			tokens: session.tokens,
			toolMetrics: new Map(session.toolMetrics),
			currentPhase: session.currentPhase,
			startedAt: session.startedAt,
		};
	}

	/**
	 * Returns session data and removes it from the store (for disk flush).
	 */
	flush(sessionID: string): SessionEvents | undefined {
		const session = this.getSession(sessionID);
		if (session) {
			this.sessions.delete(sessionID);
		}
		return session;
	}
}
