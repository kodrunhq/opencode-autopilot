import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKernelDb } from "../../src/kernel/database";
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

	test("reset clears persisted recovery state", async () => {
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

			const result = JSON.parse(await recoverCore("reset", { sessionId: "sess-4" }, db));
			expect(result.action).toBe("recovery_reset");
			expect(result.ok).toBe(true);
			const persisted = db
				.query("SELECT session_id FROM recovery_state WHERE session_id = ?")
				.get("sess-4");
			expect(persisted).toBeNull();
		} finally {
			db.close();
		}
	});
});
