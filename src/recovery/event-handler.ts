import type { Database } from "bun:sqlite";
import { getLogger } from "../logging/domains";
import { pipelineStateSchema } from "../orchestrator/schemas";
import type { RecoveryAction } from "../types/recovery";
import type { RecoveryOrchestrator } from "./orchestrator";
import { clearRecoveryState } from "./persistence";

const logger = getLogger("recovery", "event-handler");

function getEventProperties(event: {
	readonly [key: string]: unknown;
}): Record<string, unknown> {
	const properties = event.properties;
	return properties !== null && typeof properties === "object"
		? (properties as Record<string, unknown>)
		: {};
}

function extractSessionId(properties: Record<string, unknown>): string | null {
	if (typeof properties.sessionID === "string") {
		return properties.sessionID;
	}

	const info = properties.info;
	if (
		info !== null &&
		typeof info === "object" &&
		typeof (info as Record<string, unknown>).id === "string"
	) {
		return (info as Record<string, unknown>).id as string;
	}

	if (
		info !== null &&
		typeof info === "object" &&
		typeof (info as Record<string, unknown>).sessionID === "string"
	) {
		return (info as Record<string, unknown>).sessionID as string;
	}

	return null;
}

function extractError(
	properties: Record<string, unknown>,
): Error | string | null {
	if (
		properties.error instanceof Error ||
		typeof properties.error === "string"
	) {
		return properties.error;
	}

	const info = properties.info;
	if (info !== null && typeof info === "object") {
		const nestedError = (info as Record<string, unknown>).error;
		if (nestedError instanceof Error || typeof nestedError === "string") {
			return nestedError;
		}
		if (
			nestedError !== null &&
			typeof nestedError === "object" &&
			typeof (nestedError as Record<string, unknown>).message === "string"
		) {
			return new Error(
				(nestedError as Record<string, unknown>).message as string,
			);
		}
	}

	if (properties.error !== null && typeof properties.error === "object") {
		const message = (properties.error as Record<string, unknown>).message;
		if (typeof message === "string") {
			return new Error(message);
		}
	}

	return null;
}

interface PendingDispatchRow {
	readonly run_id: string;
	readonly dispatch_id: string;
	readonly phase: string;
	readonly agent: string;
}

interface PipelineRunStateRow {
	readonly state_json: string;
}

function reconcileStalePendingDispatches(
	sessionId: string,
	db: Database,
): void {
	try {
		const pendingDispatches = db
			.query(
				`SELECT run_id, dispatch_id, phase, agent
				 FROM run_pending_dispatches
				 WHERE session_id = ?`,
			)
			.all(sessionId) as PendingDispatchRow[];

		if (pendingDispatches.length === 0) {
			return;
		}

		for (const dispatch of pendingDispatches) {
			try {
				const stateRow = db
					.query(
						`SELECT state_json
						 FROM pipeline_runs
						 WHERE run_id = ?
						 ORDER BY state_revision DESC
						 LIMIT 1`,
					)
					.get(dispatch.run_id) as PipelineRunStateRow | null;

				if (!stateRow) {
					logger.warn(
						"Skipping stale pending dispatch reconciliation; pipeline run missing",
						{
							sessionId,
							runId: dispatch.run_id,
							dispatchId: dispatch.dispatch_id,
							phase: dispatch.phase,
							agent: dispatch.agent,
						},
					);
					continue;
				}

				const parsedState = pipelineStateSchema.safeParse(
					JSON.parse(stateRow.state_json),
				);
				if (!parsedState.success) {
					logger.warn(
						"Skipping stale pending dispatch reconciliation; pipeline state parse failed",
						{
							sessionId,
							runId: dispatch.run_id,
							dispatchId: dispatch.dispatch_id,
							phase: dispatch.phase,
							agent: dispatch.agent,
							error: parsedState.error.message,
						},
					);
					continue;
				}

				const timestamp = new Date().toISOString();
				const currentState = parsedState.data;
				const failureContext = {
					failedPhase: currentState.currentPhase ?? dispatch.phase,
					failedAgent: dispatch.agent,
					errorMessage:
						`Pending dispatch interrupted because session ${sessionId} terminated before returning a result: ${dispatch.phase}/${dispatch.agent}#${dispatch.dispatch_id}`.slice(
							0,
							4096,
						),
					timestamp,
					lastSuccessfulPhase:
						currentState.phases.filter((phase) => phase.status === "DONE").pop()
							?.name ?? null,
				};
				const updatedState = pipelineStateSchema.parse({
					...currentState,
					stateRevision: currentState.stateRevision + 1,
					lastUpdatedAt: timestamp,
					status: "INTERRUPTED",
					pendingDispatches: [],
					failureContext,
				});

				db.run(
					"UPDATE pipeline_runs SET state_json = ?, status = 'INTERRUPTED' WHERE run_id = ?",
					[JSON.stringify(updatedState), dispatch.run_id],
				);

				logger.info(
					"Reconciled stale pending dispatch after session termination",
					{
						sessionId,
						runId: dispatch.run_id,
						dispatchId: dispatch.dispatch_id,
						phase: dispatch.phase,
						agent: dispatch.agent,
					},
				);
			} catch (error: unknown) {
				logger.warn("Failed to reconcile stale pending dispatch", {
					sessionId,
					runId: dispatch.run_id,
					dispatchId: dispatch.dispatch_id,
					phase: dispatch.phase,
					agent: dispatch.agent,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		try {
			db.run("DELETE FROM run_pending_dispatches WHERE session_id = ?", [
				sessionId,
			]);
		} catch (error: unknown) {
			logger.warn("Failed to delete reconciled pending dispatch rows", {
				sessionId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	} catch (error: unknown) {
		logger.warn("Failed to reconcile stale pending dispatches", {
			sessionId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export interface RecoverySdkOperations {
	readonly abortSession?: (sessionId: string) => Promise<void>;
	readonly showToast?: (
		title: string,
		message: string,
		variant: string,
	) => Promise<void>;
}

function executeRecoveryAction(
	action: RecoveryAction,
	sessionId: string,
	orchestrator: RecoveryOrchestrator,
	sdk?: RecoverySdkOperations,
): void {
	logger.info("Executing recovery action", {
		sessionId,
		strategy: action.strategy,
		errorCategory: action.errorCategory,
		backoffMs: action.backoffMs,
		maxAttempts: action.maxAttempts,
	});

	switch (action.strategy) {
		case "retry": {
			if (action.backoffMs > 0) {
				setTimeout(() => {
					orchestrator.recordResult(sessionId, true);
					logger.info("Retry backoff completed", {
						sessionId,
						delayMs: action.backoffMs,
					});
				}, action.backoffMs);
			} else {
				orchestrator.recordResult(sessionId, true);
			}
			break;
		}

		case "fallback_model": {
			orchestrator.recordResult(sessionId, true);
			logger.info("Fallback model strategy triggered", {
				sessionId,
				metadata: action.metadata,
			});
			sdk
				?.showToast?.(
					"Recovery",
					`Switching model for session (${action.errorCategory})`,
					"warning",
				)
				.catch(() => {});
			break;
		}

		case "compact_and_retry": {
			if (action.backoffMs > 0) {
				setTimeout(() => {
					orchestrator.recordResult(sessionId, true);
					logger.info("Compact and retry completed", { sessionId });
				}, action.backoffMs);
			} else {
				orchestrator.recordResult(sessionId, true);
			}
			break;
		}

		case "restart_session": {
			logger.info("Session restart requested", { sessionId });
			if (sdk?.abortSession) {
				sdk
					.abortSession(sessionId)
					.then(() => {
						orchestrator.recordResult(sessionId, true);
						logger.info("Session aborted for restart", { sessionId });
					})
					.catch((error: unknown) => {
						orchestrator.recordResult(sessionId, false);
						logger.warn("Failed to abort session for restart", {
							sessionId,
							error: error instanceof Error ? error.message : String(error),
						});
					});
			} else {
				orchestrator.recordResult(sessionId, false);
				logger.warn("No SDK operations available for session restart", {
					sessionId,
				});
			}
			break;
		}

		case "reduce_context": {
			orchestrator.recordResult(sessionId, true);
			logger.info("Context reduction strategy applied", { sessionId });
			break;
		}

		case "skip_and_continue": {
			orchestrator.recordResult(sessionId, true);
			logger.info("Skipping failed step and continuing", { sessionId });
			sdk
				?.showToast?.(
					"Recovery",
					"Skipped stuck step, continuing execution",
					"warning",
				)
				.catch(() => {});
			break;
		}

		case "abort": {
			orchestrator.recordResult(sessionId, false);
			logger.warn("Recovery aborted — non-recoverable error", {
				sessionId,
				errorCategory: action.errorCategory,
			});
			sdk
				?.showToast?.(
					"Recovery Failed",
					`Unrecoverable error: ${action.errorCategory}`,
					"error",
				)
				.catch(() => {});
			break;
		}

		case "user_prompt": {
			orchestrator.recordResult(sessionId, false);
			logger.info("User intervention required", {
				sessionId,
				errorCategory: action.errorCategory,
			});
			sdk
				?.showToast?.(
					"Action Required",
					`Recovery needs input: ${action.errorCategory}`,
					"warning",
				)
				.catch(() => {});
			break;
		}

		default: {
			orchestrator.recordResult(sessionId, false);
			logger.warn("Unknown recovery strategy", {
				sessionId,
				strategy: action.strategy,
			});
		}
	}
}

interface RecoveryEventHandlerOptions {
	readonly orchestrator: RecoveryOrchestrator;
	readonly db?: Database;
	readonly sdk?: RecoverySdkOperations;
}

export function createRecoveryEventHandler(
	orchestratorOrOptions: RecoveryOrchestrator | RecoveryEventHandlerOptions,
) {
	const options: RecoveryEventHandlerOptions =
		orchestratorOrOptions instanceof Object &&
		"orchestrator" in orchestratorOrOptions
			? orchestratorOrOptions
			: { orchestrator: orchestratorOrOptions };

	const { orchestrator, db, sdk } = options;

	return async (input: {
		event: { type: string; [key: string]: unknown };
	}): Promise<void> => {
		try {
			const { event } = input;
			const properties = getEventProperties(event);

			switch (event.type) {
				case "session.error": {
					const sessionId = extractSessionId(properties);
					const error = extractError(properties);
					if (!sessionId) {
						return;
					}

					if (error) {
						const action = orchestrator.handleError(
							sessionId,
							error,
							properties,
						);
						if (action) {
							executeRecoveryAction(action, sessionId, orchestrator, sdk);
						}
					}
					if (db) {
						reconcileStalePendingDispatches(sessionId, db);
					}
					return;
				}

				case "session.deleted": {
					const sessionId = extractSessionId(properties);
					if (!sessionId) {
						return;
					}

					orchestrator.reset(sessionId);
					if (db) {
						try {
							clearRecoveryState(db, sessionId);
						} catch (error: unknown) {
							logger.warn(
								"Failed to clear persisted recovery state on session delete",
								{
									sessionId,
									error: error instanceof Error ? error.message : String(error),
								},
							);
						}
						reconcileStalePendingDispatches(sessionId, db);
					}
					logger.info("Recovery state cleared", { sessionId });
					return;
				}

				default:
					return;
			}
		} catch (error: unknown) {
			logger.warn("Recovery event handling failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};
}
