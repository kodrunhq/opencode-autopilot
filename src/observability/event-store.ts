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
			readonly sessionId: string;
			readonly failedModel: string;
			readonly nextModel: string;
			readonly reason: string;
			readonly success: boolean;
	  }
	| {
			readonly type: "error";
			readonly timestamp: string;
			readonly sessionId: string;
			readonly errorType:
				| "rate_limit"
				| "quota_exceeded"
				| "service_unavailable"
				| "missing_api_key"
				| "model_not_found"
				| "content_filter"
				| "context_length"
				| "unknown";
			readonly message: string;
			readonly model: string;
			readonly statusCode?: number;
	  }
	| {
			readonly type: "decision";
			readonly timestamp: string;
			readonly sessionId: string;
			readonly phase: string;
			readonly agent: string;
			readonly decision: string;
			readonly rationale: string;
	  }
	| {
			readonly type: "model_switch";
			readonly timestamp: string;
			readonly sessionId: string;
			readonly fromModel: string;
			readonly toModel: string;
			readonly trigger: "fallback" | "config" | "user";
	  }
	| {
			readonly type: "context_warning";
			readonly timestamp: string;
			readonly sessionId: string;
			readonly utilization: number;
			readonly contextLimit: number;
			readonly inputTokens: number;
	  }
	| {
			readonly type: "tool_complete";
			readonly timestamp: string;
			readonly sessionId: string;
			readonly tool: string;
			readonly durationMs: number;
			readonly success: boolean;
	  }
	| {
			readonly type: "phase_transition";
			readonly timestamp: string;
			readonly sessionId: string;
			readonly fromPhase: string;
			readonly toPhase: string;
	  }
	| { readonly type: "session_start"; readonly timestamp: string; readonly sessionId: string }
	| {
			readonly type: "session_end";
			readonly timestamp: string;
			readonly sessionId: string;
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
	readonly sessionId: string;
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
	sessionId: string;
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
	initSession(sessionId: string): void {
		this.sessions.set(sessionId, {
			sessionId,
			events: [],
			tokens: createEmptyTokenAggregate(),
			toolMetrics: new Map(),
			currentPhase: null,
			startedAt: new Date().toISOString(),
		});
	}

	/**
	 * Appends an event to a session. Silently returns if session is not initialized.
	 */
	appendEvent(sessionId: string, event: ObservabilityEvent): void {
		const session = this.sessions.get(sessionId);
		if (!session) return;
		session.events.push(event);
	}

	/**
	 * Accumulates token data for a session.
	 */
	accumulateTokens(sessionId: string, tokens: Partial<TokenAggregate>): void {
		const session = this.sessions.get(sessionId);
		if (!session) return;
		session.tokens = accumulateTokens(session.tokens, tokens);
	}

	/**
	 * Records a tool execution metric.
	 */
	recordToolExecution(sessionId: string, tool: string, durationMs: number, success: boolean): void {
		const session = this.sessions.get(sessionId);
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
	setCurrentPhase(sessionId: string, phase: string): void {
		const session = this.sessions.get(sessionId);
		if (!session) return;
		session.currentPhase = phase;
	}

	/**
	 * Gets the current pipeline phase for a session.
	 */
	getCurrentPhase(sessionId: string): string | null {
		return this.sessions.get(sessionId)?.currentPhase ?? null;
	}

	/**
	 * Returns a snapshot of session data without removing it.
	 */
	getSession(sessionId: string): SessionEvents | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;

		return {
			sessionId: session.sessionId,
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
	flush(sessionId: string): SessionEvents | undefined {
		const session = this.getSession(sessionId);
		if (session) {
			this.sessions.delete(sessionId);
		}
		return session;
	}
}
