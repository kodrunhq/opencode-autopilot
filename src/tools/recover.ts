import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { openProjectKernelDb } from "../kernel/database";
import { pipelineStateSchema } from "../orchestrator/schemas";
import { collectPendingDispatchCallerSessionIds } from "../orchestrator/session-correlation";
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
	readonly runId?: string;
	readonly dispatchId?: string;
	readonly orchestrator?: RecoveryOrchestrator;
}

interface RecoveryTargetResolution {
	readonly sessionIds: readonly string[];
	readonly sessionId: string | null;
	readonly runId: string | null;
	readonly dispatchId: string | null;
	readonly source: "session" | "run" | "dispatch";
}

interface RecoverySessionState {
	readonly sessionId: string;
	readonly state: RecoveryState | null;
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

function loadPipelineStateForRun(db: Database, runId: string) {
	const row = db
		.query(
			"SELECT state_json FROM pipeline_runs WHERE run_id = ? ORDER BY state_revision DESC LIMIT 1",
		)
		.get(runId) as { readonly state_json: string } | null;
	if (!row) {
		return null;
	}

	try {
		const parsed = pipelineStateSchema.safeParse(JSON.parse(row.state_json));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

interface PendingDispatchLookupRow {
	readonly run_id: string;
	readonly caller_session_id: string | null;
	readonly session_id: string | null;
}

function resolveRecoveryDispatch(db: Database, dispatchId: string) {
	const row = db
		.query(
			`SELECT run_id, caller_session_id, session_id
			 FROM run_pending_dispatches
			 WHERE dispatch_id = ?
			 ORDER BY issued_at DESC
			 LIMIT 1`,
		)
		.get(dispatchId) as PendingDispatchLookupRow | null;
	if (!row) {
		return null;
	}

	const sessionId = row.caller_session_id ?? row.session_id;
	if (!sessionId) {
		return null;
	}

	return Object.freeze({
		runId: row.run_id,
		sessionId,
	});
}

function resolveRecoveryTarget(
	options: RecoverToolOptions,
	db?: Database,
): RecoveryTargetResolution | null {
	if (options.sessionId) {
		return {
			sessionIds: Object.freeze([options.sessionId]),
			sessionId: options.sessionId,
			runId: null,
			dispatchId: null,
			source: "session",
		};
	}

	if (options.dispatchId && db) {
		const resolvedDispatch = resolveRecoveryDispatch(db, options.dispatchId);
		if (!resolvedDispatch) {
			return null;
		}

		return {
			sessionIds: Object.freeze([resolvedDispatch.sessionId]),
			sessionId: resolvedDispatch.sessionId,
			runId: resolvedDispatch.runId,
			dispatchId: options.dispatchId,
			source: "dispatch",
		};
	}

	if (!options.runId || !db) {
		return null;
	}

	const pipelineState = loadPipelineStateForRun(db, options.runId);
	if (!pipelineState) {
		return null;
	}

	const sessionIds = collectPendingDispatchCallerSessionIds(pipelineState.pendingDispatches);
	if (sessionIds.length === 0) {
		return null;
	}

	return {
		sessionIds,
		sessionId: sessionIds[0] ?? null,
		runId: options.runId,
		dispatchId: null,
		source: "run",
	};
}

function formatRecoveryStatusDisplay(
	target: RecoveryTargetResolution,
	states: readonly RecoverySessionState[],
): string {
	if (target.source === "session" || target.source === "dispatch") {
		const entry = states[0];
		const headingLines = [
			...(target.dispatchId ? [`Dispatch: ${target.dispatchId}`] : []),
			...(target.runId ? [`Run: ${target.runId}`] : []),
			`Session: ${target.sessionId}`,
		];
		if (!entry || entry.state === null) {
			return createDisplayText("Recovery status", [...headingLines, "No recovery state found."]);
		}

		return createDisplayText("Recovery status", [
			...headingLines,
			`Attempts: ${entry.state.attempts.length}/${entry.state.maxAttempts}`,
			`Recovering: ${entry.state.isRecovering ? "yes" : "no"}`,
			`Current strategy: ${entry.state.currentStrategy ?? "<none>"}`,
			`Last error: ${entry.state.lastError ?? "<none>"}`,
		]);
	}

	return createDisplayText("Recovery status", [
		`Run: ${target.runId}`,
		...states.map((entry) =>
			entry.state === null
				? `Session ${entry.sessionId}: no recovery state found.`
				: `Session ${entry.sessionId}: ${entry.state.attempts.length}/${entry.state.maxAttempts} attempts, strategy ${entry.state.currentStrategy ?? "<none>"}, recovering ${entry.state.isRecovering ? "yes" : "no"}`,
		),
	]);
}

function buildRecoveryHistoryDisplay(
	target: RecoveryTargetResolution,
	histories: readonly {
		readonly sessionId: string;
		readonly history: RecoveryState["attempts"];
	}[],
): string {
	if (target.source === "session" || target.source === "dispatch") {
		const history = histories[0]?.history ?? [];
		const targetLines = [
			...(target.dispatchId ? [`Dispatch: ${target.dispatchId}`] : []),
			...(target.runId ? [`Run: ${target.runId}`] : []),
			`Session: ${target.sessionId}`,
		];
		return createDisplayText(
			"Recovery history",
			history.length > 0
				? history.map(
						(attempt) =>
							`#${attempt.attemptNumber} ${attempt.errorCategory} -> ${attempt.strategy} (${attempt.success ? "success" : "pending"})`,
					)
				: [...targetLines, "No recovery attempts found."],
		);
	}

	const lines = [`Run: ${target.runId}`];
	for (const entry of histories) {
		if (entry.history.length === 0) {
			lines.push(`Session ${entry.sessionId}: no recovery attempts found.`);
			continue;
		}

		lines.push(`Session ${entry.sessionId}:`);
		for (const attempt of entry.history) {
			lines.push(
				`  #${attempt.attemptNumber} ${attempt.errorCategory} -> ${attempt.strategy} (${attempt.success ? "success" : "pending"})`,
			);
		}
	}

	return createDisplayText("Recovery history", lines);
}

function retryRecoverySession(
	sessionId: string,
	state: RecoveryState,
	orchestrator: RecoveryOrchestrator,
	db?: Database,
) {
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

	return Object.freeze({
		sessionId,
		nextAction,
	});
}

export async function recoverCore(
	action: RecoverToolAction,
	options: RecoverToolOptions = {},
	db?: Database,
): Promise<string> {
	const target = resolveRecoveryTarget(options, db);
	if (!target) {
		return JSON.stringify({
			action: "error",
			message: options.dispatchId
				? `No pending dispatch caller session found for dispatchId ${options.dispatchId}`
				: options.runId
					? `No pending dispatch caller sessions found for runId ${options.runId}`
					: "sessionId required",
		});
	}

	const orchestrator = getOrchestrator(options);
	const sessionStates = target.sessionIds.map((sessionId) => ({
		sessionId,
		state: getState(orchestrator, sessionId, db),
	}));

	switch (action) {
		case "status": {
			return JSON.stringify({
				action: "recovery_status",
				sessionId: target.sessionId,
				runId: target.runId,
				dispatchId: target.dispatchId,
				resolvedSessionIds: target.sessionIds,
				state: sessionStates[0]?.state ?? null,
				states: target.source === "run" ? sessionStates : undefined,
				displayText: formatRecoveryStatusDisplay(target, sessionStates),
			});
		}

		case "history": {
			const histories = sessionStates.map((entry) => ({
				sessionId: entry.sessionId,
				history: entry.state?.attempts ?? Object.freeze([]),
			}));
			return JSON.stringify({
				action: "recovery_history",
				sessionId: target.sessionId,
				runId: target.runId,
				dispatchId: target.dispatchId,
				resolvedSessionIds: target.sessionIds,
				history: histories[0]?.history ?? [],
				histories: target.source === "run" ? histories : undefined,
				displayText: buildRecoveryHistoryDisplay(target, histories),
			});
		}

		case "clear-strategies": {
			for (const sessionId of target.sessionIds) {
				orchestrator.reset(sessionId);
				if (db) {
					clearRecoveryState(db, sessionId);
				}
			}

			return JSON.stringify({
				action: "recovery_clear_strategies",
				sessionId: target.sessionId,
				runId: target.runId,
				dispatchId: target.dispatchId,
				resolvedSessionIds: target.sessionIds,
				ok: true,
				displayText: createDisplayText("Recovery strategies cleared", [
					...(target.dispatchId ? [`Dispatch: ${target.dispatchId}`] : []),
					...(target.runId ? [`Run: ${target.runId}`] : []),
					...target.sessionIds.map((sessionId) => `Session: ${sessionId}`),
					"Recovery strategy state cleared for all resolved sessions.",
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
					"SELECT run_id, dispatch_id, phase, agent FROM run_pending_dispatches WHERE issued_at < ? AND status = 'PENDING'",
				)
				.all(cutoff) as ReadonlyArray<{
				readonly run_id: string;
				readonly dispatch_id: string;
				readonly phase: string;
				readonly agent: string;
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

			db.run("DELETE FROM run_pending_dispatches WHERE issued_at < ? AND status = 'PENDING'", [
				cutoff,
			]);

			return JSON.stringify({
				action: "recovery_finalize_stuck",
				finalized,
				details,
				displayText: createDisplayText("Finalize stuck dispatches", [
					`Finalized ${finalized} stale dispatch(es):`,
					...details.map((detail) => `  - ${detail}`),
				]),
			});
		}

		case "retry": {
			const retryableStates = sessionStates.filter(
				(entry): entry is { readonly sessionId: string; readonly state: RecoveryState } =>
					entry.state !== null && entry.state.attempts.length > 0,
			);
			if (retryableStates.length === 0) {
				return JSON.stringify({
					action: "error",
					message: "No recovery history available for retry",
				});
			}

			const retries = retryableStates.map((entry) =>
				retryRecoverySession(entry.sessionId, entry.state, orchestrator, db),
			);
			const nextAction = retries[0]?.nextAction;

			return JSON.stringify({
				action: "recovery_retry",
				sessionId: target.sessionId,
				runId: target.runId,
				dispatchId: target.dispatchId,
				resolvedSessionIds: target.sessionIds,
				nextAction,
				retries: target.source === "run" ? retries : undefined,
				displayText: createDisplayText("Recovery retry", [
					...(target.dispatchId ? [`Dispatch: ${target.dispatchId}`] : []),
					...(target.runId ? [`Run: ${target.runId}`] : []),
					...retries.map(
						(retry) =>
							`Session ${retry.sessionId}: ${retry.nextAction.strategy} (${retry.nextAction.errorCategory}, ${retry.nextAction.backoffMs}ms)`,
					),
				]),
			});
		}
	}
}

export const ocRecover = tool({
	description:
		"Inspect and manage session recovery state. Actions: status, retry, clear-strategies, history, finalize-stuck. Accepts sessionId, runId, or dispatchId. The finalize-stuck action marks stale pending dispatches as INTERRUPTED. Returns JSON with displayText.",
	args: {
		action: recoverActionSchema.describe("Recovery action"),
		sessionId: tool.schema.string().min(1).optional().describe("Session ID to inspect"),
		runId: tool.schema.string().min(1).optional().describe("Run ID to inspect"),
		dispatchId: tool.schema.string().min(1).optional().describe("Dispatch ID to inspect"),
	},
	async execute({ action, sessionId, runId, dispatchId }, context) {
		const projectRoot = context.worktree ?? context.directory ?? process.cwd();
		const db = openProjectKernelDb(projectRoot);
		try {
			return await recoverCore(
				action,
				{
					sessionId: runId || dispatchId ? sessionId : (sessionId ?? context.sessionID),
					runId,
					dispatchId,
				},
				db,
			);
		} finally {
			db.close();
		}
	},
});
