import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { openProjectKernelDb } from "../kernel/database";
import {
	getDefaultRecoveryOrchestrator,
	getStrategy,
	type RecoveryOrchestrator,
} from "../recovery";
import { clearRecoveryState, loadRecoveryState } from "../recovery/persistence";
import type { RecoveryState } from "../recovery/types";

const recoverActionSchema = tool.schema.enum([
	"status",
	"retry",
	"clear-strategies",
	"history",
	"finalize-stuck",
]);
type RecoverToolAction = "status" | "retry" | "clear-strategies" | "history" | "finalize-stuck";

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

		case "clear-strategies": {
			orchestrator.reset(sessionId);
			if (db) {
				clearRecoveryState(db, sessionId);
			}

			return JSON.stringify({
				action: "recovery_clear_strategies",
				sessionId,
				ok: true,
				displayText: createDisplayText("Recovery strategies cleared", [
					`Session: ${sessionId}`,
					"Recovery strategy state cleared.",
				]),
			});
		}

		case "finalize-stuck": {
			if (!db) {
				return JSON.stringify({ action: "error", message: "Database required for finalize-stuck" });
			}

			const staleMinutes = 60;
			const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
			const rows = db
				.query(
					"SELECT run_id, dispatch_id, phase, agent, session_id FROM run_pending_dispatches WHERE issued_at < ?",
				)
				.all(cutoff) as ReadonlyArray<{
				readonly run_id: string;
				readonly dispatch_id: string;
				readonly phase: string;
				readonly agent: string;
				readonly session_id: string | null;
			}>;

			if (rows.length === 0) {
				return JSON.stringify({
					action: "recovery_finalize_stuck",
					finalized: 0,
					displayText: createDisplayText("Finalize stuck dispatches", [
						"No stale pending dispatches found.",
					]),
				});
			}

			let finalized = 0;
			const details: string[] = [];
			for (const row of rows) {
				db.run("PRAGMA foreign_keys=OFF");
				try {
					const runRow = db
						.query(
							"SELECT state_json FROM pipeline_runs WHERE run_id = ? ORDER BY state_revision DESC LIMIT 1",
						)
						.get(row.run_id) as { readonly state_json: string } | null;
					if (runRow) {
						const state = JSON.parse(runRow.state_json);
						const timestamp = new Date().toISOString();
						const lastSuccessfulPhase =
							state.phases
								?.filter((phase: { readonly status: string }) => phase.status === "DONE")
								?.pop()?.name ?? null;
						state.status = "INTERRUPTED";
						state.pendingDispatches = [];
						state.failureContext = {
							failedPhase: row.phase,
							failedAgent: row.agent,
							errorMessage: `Manually finalized: stale dispatch older than ${staleMinutes} minutes`,
							timestamp,
							lastSuccessfulPhase,
						};
						state.stateRevision = (state.stateRevision ?? 0) + 1;
						state.lastUpdatedAt = timestamp;
						db.run(
							`UPDATE pipeline_runs
							 SET state_json = ?,
							     status = 'INTERRUPTED',
							     current_phase = ?,
							     state_revision = ?,
							     last_updated_at = ?,
							     failure_phase = ?,
							     failure_agent = ?,
							     failure_message = ?,
							     last_successful_phase = ?
							 WHERE run_id = ?`,
							[
								JSON.stringify(state),
								row.phase,
								state.stateRevision,
								timestamp,
								row.phase,
								row.agent,
								state.failureContext.errorMessage,
								lastSuccessfulPhase,
								row.run_id,
							],
						);
					}
				} catch {
					// Best-effort — skip rows with invalid state
				} finally {
					db.run("PRAGMA foreign_keys=ON");
				}
				details.push(`${row.run_id}/${row.dispatch_id} (${row.phase}/${row.agent})`);
				finalized++;
			}

			db.run("DELETE FROM run_pending_dispatches WHERE issued_at < ?", [cutoff]);

			return JSON.stringify({
				action: "recovery_finalize_stuck",
				finalized,
				details,
				displayText: createDisplayText("Finalize stuck dispatches", [
					`Finalized ${finalized} stale dispatch(es):`,
					...details.map((d) => `  - ${d}`),
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
		"Inspect and manage session recovery state. Actions: status, retry, clear-strategies, history, finalize-stuck. The finalize-stuck action marks stale pending dispatches as INTERRUPTED. Returns JSON with displayText.",
	args: {
		action: recoverActionSchema.describe("Recovery action"),
		sessionId: tool.schema.string().min(1).optional().describe("Session ID to inspect"),
	},
	async execute({ action, sessionId }, context) {
		const projectRoot = context.worktree ?? context.directory ?? process.cwd();
		const db = openProjectKernelDb(projectRoot);
		try {
			return await recoverCore(action, { sessionId: sessionId ?? context.sessionID }, db);
		} finally {
			db.close();
		}
	},
});
