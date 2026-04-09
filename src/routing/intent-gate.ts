/**
 * Intent Gate: System-level enforcement for intent routing.
 *
 * Prevents agents from bypassing oc_route and calling oc_orchestrate directly
 * with intent="implementation". Enforces that oc_route must be called before
 * oc_orchestrate on every user message.
 *
 * Tracks intent classification per session, resets on user messages,
 * and validates oc_orchestrate calls have proper authorization.
 */

import { getLogger } from "../logging/domains";
import type { IntentType } from "./intent-types";

const logger = getLogger("routing", "intent-gate");

/**
 * Tracks intent classification state per session.
 * Session-level state is cleared on user messages.
 */
export class IntentTracker {
	private readonly sessionIntentMap = new Map<string, IntentType>();
	private readonly sessionUserMessageMap = new Map<string, number>();

	/**
	 * Store intent classification for a session.
	 * Called by oc_route after successful classification.
	 */
	storeIntentClassification(sessionID: string, intent: IntentType): void {
		this.sessionIntentMap.set(sessionID, intent);
		logger.debug("Intent classification stored", { sessionID, intent });
	}

	/**
	 * Check if intent is authorized for a session.
	 *
	 * Bare oc_orchestrate calls are only allowed after an implementation
	 * classification. Explicit intents must match exactly.
	 */
	isIntentAuthorized(sessionID: string, intent?: IntentType): boolean {
		const storedIntent = this.sessionIntentMap.get(sessionID);
		if (!storedIntent) {
			return false;
		}

		// Bare oc_orchestrate calls are only valid for implementation work.
		if (!intent) {
			return storedIntent === "implementation";
		}

		if (intent !== "implementation") {
			return false;
		}

		return storedIntent === "implementation";
	}

	/**
	 * Reset intent tracking for a new user message.
	 * Called when a user message is detected.
	 */
	resetForUserMessage(sessionID: string): void {
		this.sessionIntentMap.delete(sessionID);
		logger.debug("Intent tracking reset for user message", { sessionID });
	}

	/**
	 * Clear all tracking for a session.
	 * Called on session.deleted events.
	 */
	clearSession(sessionID: string): void {
		this.sessionIntentMap.delete(sessionID);
		this.sessionUserMessageMap.delete(sessionID);
		logger.debug("Session cleared from intent tracking", { sessionID });
	}

	/**
	 * Record a user message for session tracking.
	 * Used to detect when to reset intent classification.
	 */
	recordUserMessage(sessionID: string): void {
		const count = (this.sessionUserMessageMap.get(sessionID) || 0) + 1;
		this.sessionUserMessageMap.set(sessionID, count);
		logger.debug("User message recorded", { sessionID, messageCount: count });
	}

	/**
	 * Get current intent for a session (for debugging/logging).
	 */
	getCurrentIntent(sessionID: string): IntentType | null {
		return this.sessionIntentMap.get(sessionID) || null;
	}
}

// Singleton instance for the plugin
export const intentTracker = new IntentTracker();

/**
 * Validate that oc_orchestrate calls are properly authorized.
 * Called from tool.execute.before hook.
 *
 * Rules:
 * 1. oc_orchestrate with intent="implementation" requires prior oc_route classification
 * 2. oc_orchestrate without intent (result-based resumes) are allowed
 * 3. oc_route calls are always allowed (they set the intent)
 * 4. All other tools are unaffected
 */
export function enforceIntentGate(
	tool: string,
	sessionID: string,
	args: unknown,
): { allowed: boolean; reason?: string } {
	// Only gate oc_orchestrate calls
	if (tool !== "oc_orchestrate") {
		return { allowed: true };
	}

	// Parse args to check for intent
	let intent: IntentType | undefined;
	let hasResult = false;

	try {
		if (args && typeof args === "object" && "intent" in args) {
			const intentValue = (args as Record<string, unknown>).intent;
			if (typeof intentValue === "string") {
				// Validate it's a known intent type
				const validIntents: readonly string[] = [
					"research",
					"implementation",
					"investigation",
					"evaluation",
					"fix",
					"review",
					"planning",
					"quick",
					"open_ended",
				];
				if (validIntents.includes(intentValue)) {
					intent = intentValue as IntentType;
				}
			}
		}

		// Check if this is a result-based resume (has result field)
		if (args && typeof args === "object" && "result" in args) {
			const resultValue = (args as Record<string, unknown>).result;
			hasResult = typeof resultValue === "string" && resultValue.length > 0;
		}
	} catch (error) {
		// If we can't parse args, be permissive but log
		logger.warn("Failed to parse oc_orchestrate args for intent gate", {
			sessionID,
			error: error instanceof Error ? error.message : String(error),
		});
		return { allowed: true };
	}

	// Result-based resumes are allowed (machine-driven continuations)
	if (hasResult) {
		return { allowed: true, reason: "result-based resume" };
	}

	if (intent && intent !== "implementation") {
		return {
			allowed: false,
			reason: `oc_orchestrate only supports implementation intent; received "${intent}"`,
		};
	}

	// If intent is not specified, require classification
	if (!intent) {
		if (!intentTracker.isIntentAuthorized(sessionID)) {
			return {
				allowed: false,
				reason:
					"oc_orchestrate without a result requires an implementation classification via oc_route first",
			};
		}
		return {
			allowed: true,
			reason: "no intent specified, but session is classified for implementation",
		};
	}

	// Intent is specified, check authorization
	if (!intentTracker.isIntentAuthorized(sessionID, intent)) {
		return {
			allowed: false,
			reason: `implementation intent not authorized for this session. Call oc_route first.`,
		};
	}

	return { allowed: true };
}

/**
 * Store intent classification from oc_route.
 * Wrapper around intentTracker.storeIntentClassification for easier import.
 */
export function storeIntentClassification(sessionID: string, intent: IntentType): void {
	intentTracker.storeIntentClassification(sessionID, intent);
}

/**
 * Reset intent tracking for a new user message.
 * Called from message.updated hook when user message is detected.
 */
export function resetIntentForUserMessage(sessionID: string): void {
	intentTracker.resetForUserMessage(sessionID);
}

/**
 * Clear session tracking.
 * Called from session.deleted hook.
 */
export function clearIntentSession(sessionID: string): void {
	intentTracker.clearSession(sessionID);
}
