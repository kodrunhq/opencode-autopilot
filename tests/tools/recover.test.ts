import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKernelDb } from "../../src/kernel/database";
import { createInitialState, saveState } from "../../src/orchestrator/state";
import { RecoveryOrchestrator } from "../../src/recovery/orchestrator";
import { saveRecoveryState } from "../../src/recovery/persistence";
import { recoverCore } from "../../src/tools/recover";

describe("recoverCore", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "recover-tool-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("status returns current recovery state", async () => {
		const orchestrator = new RecoveryOrchestrator();
		orchestrator.handleError("sess-1", "rate limit exceeded");
		const result = JSON.parse(await recoverCore("status", { sessionId: "sess-1", orchestrator }));

		expect(result.action).toBe("recovery_status");
		expect(result.state.sessionId).toBe("sess-1");
	});

	test("history returns attempt log", async () => {
		const orchestrator = new RecoveryOrchestrator();
		orchestrator.handleError("sess-2", "timeout");
		const result = JSON.parse(await recoverCore("history", { sessionId: "sess-2", orchestrator }));

		expect(result.action).toBe("recovery_history");
		expect(result.history).toHaveLength(1);
	});

	test("retry resets counter and returns next strategy", async () => {
		const orchestrator = new RecoveryOrchestrator();
		orchestrator.handleError("sess-3", "empty content");
		const result = JSON.parse(await recoverCore("retry", { sessionId: "sess-3", orchestrator }));

		expect(result.action).toBe("recovery_retry");
		expect(result.nextAction.strategy).toBe("fallback_model");
		expect(orchestrator.getState("sess-3")).toBeNull();
	});

	test("clear-strategies clears persisted recovery state", async () => {
		const db = openKernelDb(tempDir);
		try {
			saveRecoveryState(db, {
				sessionId: "sess-4",
				attempts: Object.freeze([]),
				currentStrategy: null,
				maxAttempts: 3,
				isRecovering: false,
				lastError: null,
			});

			const result = JSON.parse(await recoverCore("clear-strategies", { sessionId: "sess-4" }, db));
			expect(result.action).toBe("recovery_clear_strategies");
			expect(result.ok).toBe(true);
			const persisted = db
				.query("SELECT session_id FROM recovery_state WHERE session_id = ?")
				.get("sess-4");
			expect(persisted).toBeNull();
		} finally {
			db.close();
		}
	});

	test("status resolves recovery state from runId via pending dispatch caller session", async () => {
		const state = createInitialState("recover by runId");
		await saveState(
			{
				...state,
				pendingDispatches: [
					{
						dispatchId: "dispatch_recover_run",
						phase: "RECON",
						agent: "oc-researcher",
						issuedAt: new Date().toISOString(),
						status: "PENDING",
						receivedResultId: null,
						receivedAt: null,
						resultKind: "phase_output",
						taskId: null,
						callerSessionId: "sess-run",
						spawnedSessionId: "child-run",
						sessionId: "sess-run",
					},
				],
			},
			tempDir,
		);

		const db = openKernelDb(tempDir);
		try {
			saveRecoveryState(db, {
				sessionId: "sess-run",
				attempts: Object.freeze([]),
				currentStrategy: null,
				maxAttempts: 3,
				isRecovering: false,
				lastError: null,
			});

			const result = JSON.parse(await recoverCore("status", { runId: state.runId }, db));
			expect(result.action).toBe("recovery_status");
			expect(result.runId).toBe(state.runId);
			expect(result.sessionId).toBe("sess-run");
			expect(result.resolvedSessionIds).toEqual(["sess-run"]);
			expect(result.state.sessionId).toBe("sess-run");
		} finally {
			db.close();
		}
	});

	test("status resolves recovery state from dispatchId via pending dispatch caller session", async () => {
		const state = createInitialState("recover by dispatchId");
		await saveState(
			{
				...state,
				pendingDispatches: [
					{
						dispatchId: "dispatch_recover_dispatch",
						phase: "RECON",
						agent: "oc-researcher",
						issuedAt: new Date().toISOString(),
						status: "FAILED_RECOVERABLE",
						receivedResultId: "result-recover-dispatch",
						receivedAt: new Date().toISOString(),
						resultKind: "phase_output",
						taskId: null,
						callerSessionId: "sess-dispatch",
						spawnedSessionId: null,
						sessionId: "sess-dispatch",
					},
				],
			},
			tempDir,
		);

		const db = openKernelDb(tempDir);
		try {
			saveRecoveryState(db, {
				sessionId: "sess-dispatch",
				attempts: Object.freeze([]),
				currentStrategy: null,
				maxAttempts: 3,
				isRecovering: false,
				lastError: null,
			});

			const result = JSON.parse(
				await recoverCore("status", { dispatchId: "dispatch_recover_dispatch" }, db),
			);
			expect(result.action).toBe("recovery_status");
			expect(result.dispatchId).toBe("dispatch_recover_dispatch");
			expect(result.runId).toBe(state.runId);
			expect(result.sessionId).toBe("sess-dispatch");
			expect(result.resolvedSessionIds).toEqual(["sess-dispatch"]);
			expect(result.state.sessionId).toBe("sess-dispatch");
		} finally {
			db.close();
		}
	});
});
