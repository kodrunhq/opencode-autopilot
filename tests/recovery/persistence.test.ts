import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKernelDb } from "../../src/kernel/database";
import {
	clearRecoveryState,
	listRecoveryStates,
	loadRecoveryState,
	saveRecoveryState,
} from "../../src/recovery/persistence";
import type { RecoveryState } from "../../src/recovery/types";

describe("recovery persistence", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "recovery-persistence-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("save and load round-trip recovery state", () => {
		const db = openKernelDb(tempDir);
		try {
			const state: RecoveryState = {
				sessionId: "sess-1",
				attempts: Object.freeze([
					{
						attemptNumber: 1,
						strategy: "retry",
						errorCategory: "rate_limit",
						timestamp: new Date().toISOString(),
						success: false,
						error: "rate limit exceeded",
					},
				]),
				currentStrategy: "retry",
				maxAttempts: 3,
				isRecovering: true,
				lastError: "rate limit exceeded",
			};

			saveRecoveryState(db, state);
			const loaded = loadRecoveryState(db, "sess-1");
			expect(loaded).toEqual(state);
		} finally {
			db.close();
		}
	});

	test("clear removes persisted state", () => {
		const db = openKernelDb(tempDir);
		try {
			saveRecoveryState(db, {
				sessionId: "sess-2",
				attempts: Object.freeze([]),
				currentStrategy: null,
				maxAttempts: 3,
				isRecovering: false,
				lastError: null,
			});

			clearRecoveryState(db, "sess-2");
			expect(loadRecoveryState(db, "sess-2")).toBeNull();
		} finally {
			db.close();
		}
	});

	test("list returns all saved states", () => {
		const db = openKernelDb(tempDir);
		try {
			saveRecoveryState(db, {
				sessionId: "sess-a",
				attempts: Object.freeze([]),
				currentStrategy: null,
				maxAttempts: 3,
				isRecovering: false,
				lastError: null,
			});
			saveRecoveryState(db, {
				sessionId: "sess-b",
				attempts: Object.freeze([]),
				currentStrategy: null,
				maxAttempts: 4,
				isRecovering: false,
				lastError: null,
			});

			const states = listRecoveryStates(db);
			expect(states).toHaveLength(2);
			expect(states.map((state) => state.sessionId).sort()).toEqual(["sess-a", "sess-b"]);
		} finally {
			db.close();
		}
	});

	test("kernel migration creates recovery_state table", () => {
		const db = openKernelDb(tempDir);
		try {
			const row = db
				.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recovery_state'")
				.get() as { name?: string } | null;
			expect(row?.name).toBe("recovery_state");
		} finally {
			db.close();
		}
	});
});
