import type { Database } from "bun:sqlite";
import { withTransaction } from "../kernel/transaction";
import type { RecoveryAttempt, RecoveryState } from "./types";

interface RecoveryStateRow {
	readonly session_id: string;
	readonly state_json: string;
	readonly updated_at: string;
}

function isRecoveryAttempt(value: unknown): value is RecoveryAttempt {
	if (value === null || typeof value !== "object") {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.attemptNumber === "number" &&
		typeof candidate.strategy === "string" &&
		typeof candidate.errorCategory === "string" &&
		typeof candidate.timestamp === "string" &&
		typeof candidate.success === "boolean" &&
		(candidate.error === undefined || typeof candidate.error === "string")
	);
}

function isRecoveryState(value: unknown): value is RecoveryState {
	if (value === null || typeof value !== "object") {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.sessionId === "string" &&
		Array.isArray(candidate.attempts) &&
		candidate.attempts.every(isRecoveryAttempt) &&
		(candidate.currentStrategy === null || typeof candidate.currentStrategy === "string") &&
		typeof candidate.maxAttempts === "number" &&
		typeof candidate.isRecovering === "boolean" &&
		(candidate.lastError === null || typeof candidate.lastError === "string")
	);
}

function parseState(row: RecoveryStateRow | null): RecoveryState | null {
	if (!row) {
		return null;
	}

	const parsed = JSON.parse(row.state_json) as unknown;
	return isRecoveryState(parsed) ? Object.freeze(parsed) : null;
}

export function saveRecoveryState(db: Database, state: RecoveryState): void {
	const updatedAt = new Date().toISOString();
	withTransaction(db, () => {
		db.run(
			`INSERT INTO recovery_state (session_id, state_json, updated_at)
			 VALUES (?, ?, ?)
			 ON CONFLICT(session_id) DO UPDATE SET
			 state_json = excluded.state_json,
			 updated_at = excluded.updated_at`,
			[state.sessionId, JSON.stringify(state), updatedAt],
		);
	});
}

export function loadRecoveryState(db: Database, sessionId: string): RecoveryState | null {
	const row = db
		.query("SELECT session_id, state_json, updated_at FROM recovery_state WHERE session_id = ?")
		.get(sessionId) as RecoveryStateRow | null;
	return parseState(row);
}

export function clearRecoveryState(db: Database, sessionId: string): void {
	withTransaction(db, () => {
		db.run("DELETE FROM recovery_state WHERE session_id = ?", [sessionId]);
	});
}

export function listRecoveryStates(db: Database): readonly RecoveryState[] {
	const rows = db
		.query("SELECT session_id, state_json, updated_at FROM recovery_state ORDER BY updated_at DESC")
		.all() as RecoveryStateRow[];
	return Object.freeze(
		rows.map(parseState).filter((state): state is RecoveryState => state !== null),
	);
}
