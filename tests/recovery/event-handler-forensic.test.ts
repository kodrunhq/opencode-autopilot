import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runKernelMigrations } from "../../src/kernel/migrations";
import { createInitialState } from "../../src/orchestrator/state";
import { createRecoveryEventHandler } from "../../src/recovery/event-handler";
import { RecoveryOrchestrator } from "../../src/recovery/orchestrator";

const FIXED_TIMESTAMP = "2026-04-12T00:00:00.000Z";

function createRecoveryDb(): Database {
	const db = new Database(":memory:");
	runKernelMigrations(db);
	return db;
}

function insertProject(db: Database, projectId: string): void {
	db.run(
		"INSERT INTO projects (id, path, name, first_seen_at, last_updated) VALUES (?, ?, ?, ?, ?)",
		[projectId, `/tmp/${projectId}`, projectId, FIXED_TIMESTAMP, FIXED_TIMESTAMP],
	);
}

function createStateWithPendingDispatch(runId: string, sessionId: string) {
	const initialState = createInitialState("forensic recovery");
	return {
		...initialState,
		runId,
		startedAt: FIXED_TIMESTAMP,
		lastUpdatedAt: FIXED_TIMESTAMP,
		pendingDispatches: [
			{
				dispatchId: "dispatch_forensic_1",
				phase: "RECON" as const,
				agent: "oc-researcher",
				issuedAt: FIXED_TIMESTAMP,
				resultKind: "phase_output" as const,
				taskId: null,
				sessionId,
			},
		],
	};
}

function insertPipelineRun(
	db: Database,
	options: {
		readonly projectId: string;
		readonly runId: string;
		readonly stateJson: string;
		readonly status?: string;
		readonly stateRevision?: number;
	},
): void {
	db.run(
		`INSERT INTO pipeline_runs (
			project_id,
			run_id,
			schema_version,
			status,
			current_phase,
			idea,
			state_revision,
			started_at,
			last_updated_at,
			failure_phase,
			failure_agent,
			failure_message,
			last_successful_phase,
			state_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			options.projectId,
			options.runId,
			2,
			options.status ?? "IN_PROGRESS",
			"RECON",
			"forensic recovery",
			options.stateRevision ?? 0,
			FIXED_TIMESTAMP,
			FIXED_TIMESTAMP,
			null,
			null,
			null,
			null,
			options.stateJson,
		],
	);
}

function insertPendingDispatch(db: Database, runId: string, sessionId: string): void {
	db.run(
		`INSERT INTO run_pending_dispatches (
			run_id,
			dispatch_id,
			phase,
			agent,
			issued_at,
			result_kind,
			task_id,
			session_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			runId,
			"dispatch_forensic_1",
			"RECON",
			"oc-researcher",
			FIXED_TIMESTAMP,
			"phase_output",
			null,
			sessionId,
		],
	);
}

describe("recovery event handler forensic reconciliation", () => {
	let db: Database;
	let handler: ReturnType<typeof createRecoveryEventHandler>;

	beforeEach(() => {
		db = createRecoveryDb();
		handler = createRecoveryEventHandler({
			orchestrator: new RecoveryOrchestrator(),
			db,
		});
	});

	afterEach(() => {
		db.close();
	});

	test("matching session ids interrupt the pipeline and delete reconciled pending dispatches", async () => {
		const projectId = "project-forensic-match";
		const runId = "run_forensic_match";
		const sessionId = "session-forensic-match";
		insertProject(db, projectId);
		const state = createStateWithPendingDispatch(runId, sessionId);
		insertPipelineRun(db, {
			projectId,
			runId,
			stateJson: JSON.stringify(state),
		});
		insertPendingDispatch(db, runId, sessionId);

		await handler({
			event: {
				type: "session.error",
				properties: { sessionID: sessionId },
			},
		});

		const runRow = db
			.query(
				`SELECT status, state_revision as stateRevision, failure_phase as failurePhase,
				        failure_agent as failureAgent, failure_message as failureMessage,
				        state_json as stateJson
				 FROM pipeline_runs
				 WHERE run_id = ?`,
			)
			.get(runId) as {
			status: string;
			stateRevision: number;
			failurePhase: string | null;
			failureAgent: string | null;
			failureMessage: string | null;
			stateJson: string;
		};
		const pendingCount = db
			.query("SELECT COUNT(*) as count FROM run_pending_dispatches WHERE session_id = ?")
			.get(sessionId) as { count: number };
		const parsedState = JSON.parse(runRow.stateJson) as {
			status: string;
			stateRevision: number;
			pendingDispatches: unknown[];
			failureContext: {
				failedPhase: string;
				failedAgent: string | null;
				errorMessage: string;
			};
		};

		expect(runRow.status).toBe("INTERRUPTED");
		expect(runRow.stateRevision).toBe(1);
		expect(runRow.failurePhase).toBe("RECON");
		expect(runRow.failureAgent).toBe("oc-researcher");
		expect(runRow.failureMessage).toContain(sessionId);
		expect(parsedState.status).toBe("INTERRUPTED");
		expect(parsedState.stateRevision).toBe(1);
		expect(parsedState.pendingDispatches).toEqual([]);
		expect(parsedState.failureContext.failedPhase).toBe("RECON");
		expect(parsedState.failureContext.failedAgent).toBe("oc-researcher");
		expect(parsedState.failureContext.errorMessage).toContain(sessionId);
		expect(pendingCount.count).toBe(0);
	});

	test("non-matching session ids leave pending dispatches and pipeline state untouched", async () => {
		const projectId = "project-forensic-unmatched";
		const runId = "run_forensic_unmatched";
		const pendingSessionId = "session-pending";
		insertProject(db, projectId);
		insertPipelineRun(db, {
			projectId,
			runId,
			stateJson: JSON.stringify(createStateWithPendingDispatch(runId, pendingSessionId)),
		});
		insertPendingDispatch(db, runId, pendingSessionId);

		await handler({
			event: {
				type: "session.error",
				properties: { sessionID: "different-session" },
			},
		});

		const runRow = db
			.query("SELECT status, state_revision as stateRevision FROM pipeline_runs WHERE run_id = ?")
			.get(runId) as {
			status: string;
			stateRevision: number;
		};
		const pendingCount = db
			.query("SELECT COUNT(*) as count FROM run_pending_dispatches WHERE session_id = ?")
			.get(pendingSessionId) as { count: number };

		expect(runRow.status).toBe("IN_PROGRESS");
		expect(runRow.stateRevision).toBe(0);
		expect(pendingCount.count).toBe(1);
	});

	test("missing pipeline runs are skipped gracefully and matched pending dispatches are deleted", async () => {
		insertPendingDispatch(db, "run_missing_pipeline", "session-missing-pipeline");

		await expect(
			handler({
				event: {
					type: "session.error",
					properties: { sessionID: "session-missing-pipeline" },
				},
			}),
		).resolves.toBeUndefined();

		const pendingCount = db
			.query("SELECT COUNT(*) as count FROM run_pending_dispatches WHERE session_id = ?")
			.get("session-missing-pipeline") as { count: number };

		expect(pendingCount.count).toBe(0);
	});

	test("invalid pipeline state_json is handled gracefully and matched pending dispatches are deleted", async () => {
		const projectId = "project-forensic-invalid-state";
		const runId = "run_forensic_invalid_state";
		const sessionId = "session-invalid-state";
		insertProject(db, projectId);
		insertPipelineRun(db, {
			projectId,
			runId,
			stateJson: "{not-valid-json",
		});
		insertPendingDispatch(db, runId, sessionId);

		await expect(
			handler({
				event: {
					type: "session.error",
					properties: { sessionID: sessionId },
				},
			}),
		).resolves.toBeUndefined();

		const runRow = db
			.query(
				"SELECT status, state_revision as stateRevision, state_json as stateJson FROM pipeline_runs WHERE run_id = ?",
			)
			.get(runId) as {
			status: string;
			stateRevision: number;
			stateJson: string;
		};
		const pendingCount = db
			.query("SELECT COUNT(*) as count FROM run_pending_dispatches WHERE session_id = ?")
			.get(sessionId) as { count: number };

		expect(runRow.status).toBe("IN_PROGRESS");
		expect(runRow.stateRevision).toBe(0);
		expect(runRow.stateJson).toBe("{not-valid-json");
		expect(pendingCount.count).toBe(0);
	});
});
