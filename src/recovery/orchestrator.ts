import type { Database } from "bun:sqlite";
import { getLogger } from "../logging/domains";
import type { Logger } from "../logging/types";
import type { RecoveryAction } from "../types/recovery";
import { classifyError } from "./classifier";
import { clearRecoveryState, loadRecoveryState, saveRecoveryState } from "./persistence";
import { getStrategy } from "./strategies";
import type { RecoveryAttempt, RecoveryState } from "./types";

interface RecoveryOrchestratorOptions {
	readonly maxAttempts?: number;
	readonly logger?: Logger;
	readonly db?: Database;
}

function getErrorMessage(error: Error | string): string {
	return typeof error === "string" ? error : error.message;
}

function cloneState(state: RecoveryState): RecoveryState {
	return Object.freeze({
		...state,
		attempts: Object.freeze([...state.attempts]),
	});
}

export class RecoveryOrchestrator {
	private readonly maxAttempts: number;
	private readonly logger: Logger;
	private readonly db: Database | null;
	private readonly states = new Map<string, RecoveryState>();

	constructor(options: RecoveryOrchestratorOptions = {}) {
		this.maxAttempts = options.maxAttempts ?? 3;
		this.logger = options.logger ?? getLogger("recovery", "orchestrator");
		this.db = options.db ?? null;
	}

	handleError(
		sessionId: string,
		error: Error | string,
		context?: Record<string, unknown>,
	): RecoveryAction | null {
		const classification = classifyError(error, context);
		if (!classification.isRecoverable) {
			this.logger.warn("Recovery skipped for non-recoverable error", {
				sessionId,
				category: classification.category,
			});
			return null;
		}

		const previousState = this.states.get(sessionId) ??
			this.loadFromDb(sessionId) ?? {
				sessionId,
				attempts: Object.freeze([]),
				currentStrategy: null,
				maxAttempts: this.maxAttempts,
				isRecovering: false,
				lastError: null,
			};

		if (previousState.attempts.length >= previousState.maxAttempts) {
			this.logger.warn("Recovery attempt limit reached", {
				sessionId,
				attempts: previousState.attempts.length,
				maxAttempts: previousState.maxAttempts,
			});
			return null;
		}

		const action = getStrategy(classification.category)(previousState);
		const attempt: RecoveryAttempt = Object.freeze({
			attemptNumber: previousState.attempts.length + 1,
			strategy: action.strategy,
			errorCategory: classification.category,
			timestamp: new Date().toISOString(),
			success: false,
			error: getErrorMessage(error),
		});

		const nextState = cloneState({
			sessionId,
			attempts: Object.freeze([...previousState.attempts, attempt]),
			currentStrategy: action.strategy,
			maxAttempts: previousState.maxAttempts,
			isRecovering: true,
			lastError: getErrorMessage(error),
		});

		this.states.set(sessionId, nextState);
		this.persistToDb(nextState);
		return action;
	}

	getState(sessionId: string): RecoveryState | null {
		const state = this.states.get(sessionId);
		return state ? cloneState(state) : null;
	}

	reset(sessionId: string): void {
		this.states.delete(sessionId);
		this.clearFromDb(sessionId);
	}

	getHistory(sessionId: string): readonly RecoveryAttempt[] {
		return this.getState(sessionId)?.attempts ?? Object.freeze([]);
	}

	recordResult(sessionId: string, success: boolean): void {
		const state = this.states.get(sessionId);
		if (!state || state.attempts.length === 0) {
			return;
		}

		const lastAttempt = state.attempts[state.attempts.length - 1];
		const updatedAttempt: RecoveryAttempt = Object.freeze({
			...lastAttempt,
			success,
		});
		const attempts = Object.freeze([...state.attempts.slice(0, -1), updatedAttempt]);
		const nextState = cloneState({
			...state,
			attempts,
			currentStrategy: success ? null : state.currentStrategy,
			isRecovering: false,
			lastError: success ? null : state.lastError,
		});
		this.states.set(sessionId, nextState);
		this.persistToDb(nextState);
	}

	private loadFromDb(sessionId: string): RecoveryState | null {
		if (!this.db) return null;
		try {
			return loadRecoveryState(this.db, sessionId);
		} catch {
			return null;
		}
	}

	private persistToDb(state: RecoveryState): void {
		if (!this.db) return;
		try {
			saveRecoveryState(this.db, state);
		} catch (error) {
			this.logger.warn("Failed to persist recovery state", {
				sessionId: state.sessionId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private clearFromDb(sessionId: string): void {
		if (!this.db) return;
		try {
			clearRecoveryState(this.db, sessionId);
		} catch (error) {
			this.logger.warn("Failed to clear recovery state", {
				sessionId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}

let defaultRecoveryOrchestrator: RecoveryOrchestrator | null = null;

export function getDefaultRecoveryOrchestrator(): RecoveryOrchestrator {
	if (defaultRecoveryOrchestrator) {
		return defaultRecoveryOrchestrator;
	}

	defaultRecoveryOrchestrator = new RecoveryOrchestrator();
	return defaultRecoveryOrchestrator;
}

export function createRecoveryOrchestratorWithDb(db: Database): RecoveryOrchestrator {
	return new RecoveryOrchestrator({ db });
}
