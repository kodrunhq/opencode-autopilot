import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { openKernelDb } from "../kernel/database";
import {
	getDefaultRecoveryOrchestrator,
	getStrategy,
	type RecoveryOrchestrator,
} from "../recovery";
import { clearRecoveryState, loadRecoveryState } from "../recovery/persistence";
import type { RecoveryState } from "../recovery/types";

const recoverActionSchema = tool.schema.enum(["status", "retry", "reset", "history"]);
type RecoverToolAction = "status" | "retry" | "reset" | "history";

interface RecoverToolOptions {
	readonly sessionId?: string;
	readonly orchestrator?: RecoveryOrchestrator;
}

function createDisplayText(title: string, lines: readonly string[]): string {
	return [title, ...lines].join("\n");
}

function getOrchestrator(options?: RecoverToolOptions): RecoveryOrchestrator {
	return options?.orchestrator ?? getDefaultRecoveryOrchestrator();
}

function getState(
	orchestrator: RecoveryOrchestrator,
	sessionId: string,
	db?: Database,
): RecoveryState | null {
	const inMemoryState = orchestrator.getState(sessionId);
	if (inMemoryState) {
		return inMemoryState;
	}

	return db ? loadRecoveryState(db, sessionId) : null;
}

export async function recoverCore(
	action: RecoverToolAction,
	options: RecoverToolOptions = {},
	db?: Database,
): Promise<string> {
	const sessionId = options.sessionId;
	if (!sessionId) {
		return JSON.stringify({ action: "error", message: "sessionId required" });
	}

	const orchestrator = getOrchestrator(options);
	const state = getState(orchestrator, sessionId, db);

	switch (action) {
		case "status": {
			if (!state) {
				return JSON.stringify({
					action: "recovery_status",
					sessionId,
					state: null,
					displayText: createDisplayText("Recovery status", [
						`Session: ${sessionId}`,
						"No recovery state found.",
					]),
				});
			}

			return JSON.stringify({
				action: "recovery_status",
				sessionId,
				state,
				displayText: createDisplayText("Recovery status", [
					`Session: ${sessionId}`,
					`Attempts: ${state.attempts.length}/${state.maxAttempts}`,
					`Recovering: ${state.isRecovering ? "yes" : "no"}`,
					`Current strategy: ${state.currentStrategy ?? "<none>"}`,
					`Last error: ${state.lastError ?? "<none>"}`,
				]),
			});
		}

		case "history": {
			const history = state?.attempts ?? [];
			return JSON.stringify({
				action: "recovery_history",
				sessionId,
				history,
				displayText: createDisplayText(
					"Recovery history",
					history.length > 0
						? history.map(
								(attempt) =>
									`#${attempt.attemptNumber} ${attempt.errorCategory} -> ${attempt.strategy} (${attempt.success ? "success" : "pending"})`,
							)
						: [`Session: ${sessionId}`, "No recovery attempts found."],
				),
			});
		}

		case "reset": {
			orchestrator.reset(sessionId);
			if (db) {
				clearRecoveryState(db, sessionId);
			}

			return JSON.stringify({
				action: "recovery_reset",
				sessionId,
				ok: true,
				displayText: createDisplayText("Recovery reset", [
					`Session: ${sessionId}`,
					"Recovery state cleared.",
				]),
			});
		}

		case "retry": {
			if (!state || state.attempts.length === 0) {
				return JSON.stringify({
					action: "error",
					message: "No recovery history available for retry",
				});
			}

			const lastAttempt = state.attempts[state.attempts.length - 1];
			orchestrator.reset(sessionId);
			if (db) {
				clearRecoveryState(db, sessionId);
			}

			const nextAction = getStrategy(lastAttempt.errorCategory)({
				sessionId,
				attempts: Object.freeze([]),
				currentStrategy: null,
				maxAttempts: state.maxAttempts,
				isRecovering: false,
				lastError: state.lastError,
			});

			return JSON.stringify({
				action: "recovery_retry",
				sessionId,
				nextAction,
				displayText: createDisplayText("Recovery retry", [
					`Session: ${sessionId}`,
					`Strategy: ${nextAction.strategy}`,
					`Category: ${nextAction.errorCategory}`,
					`Backoff: ${nextAction.backoffMs}ms`,
				]),
			});
		}
	}

	return JSON.stringify({ action: "error", message: `Unsupported action: ${action}` });
}

export const ocRecover = tool({
	description:
		"Inspect and manage session recovery state. Actions: status, retry, reset, history. Returns JSON with displayText.",
	args: {
		action: recoverActionSchema.describe("Recovery action"),
		sessionId: tool.schema.string().min(1).optional().describe("Session ID to inspect"),
	},
	async execute({ action, sessionId }, context) {
		const db = openKernelDb();
		try {
			return await recoverCore(action, { sessionId: sessionId ?? context.sessionID }, db);
		} finally {
			db.close();
		}
	},
});
