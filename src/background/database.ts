import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { type TaskStatus, TaskStatusSchema } from "../types/background";

export const ACTIVE_TASK_STATUSES = Object.freeze(["pending", "running"] as const);
export const TERMINAL_TASK_STATUSES = Object.freeze(["completed", "failed", "cancelled"] as const);

export interface BackgroundTaskRecord {
	readonly id: string;
	readonly sessionId: string;
	readonly description: string;
	readonly category: string | null;
	readonly status: TaskStatus;
	readonly result: string | null;
	readonly error: string | null;
	readonly agent: string | null;
	readonly model: string | null;
	readonly priority: number;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly startedAt: string | null;
	readonly completedAt: string | null;
}

export interface CreateBackgroundTaskInput {
	readonly id?: string;
	readonly sessionId: string;
	readonly description: string;
	readonly category?: string | null;
	readonly status?: TaskStatus;
	readonly result?: string | null;
	readonly error?: string | null;
	readonly agent?: string | null;
	readonly model?: string | null;
	readonly priority?: number;
	readonly createdAt?: string;
	readonly updatedAt?: string;
	readonly startedAt?: string | null;
	readonly completedAt?: string | null;
}

export interface BackgroundTaskResultRecord {
	readonly status: TaskStatus;
	readonly result: string | null;
	readonly error: string | null;
	readonly completedAt: string | null;
}

interface BackgroundTaskRow {
	readonly id: string;
	readonly session_id: string;
	readonly description: string;
	readonly category: string | null;
	readonly status: string;
	readonly result: string | null;
	readonly error: string | null;
	readonly agent: string | null;
	readonly model: string | null;
	readonly priority: number;
	readonly created_at: string;
	readonly updated_at: string;
	readonly started_at: string | null;
	readonly completed_at: string | null;
}

function isClosedDatabaseError(error: unknown): boolean {
	return (
		error instanceof RangeError &&
		typeof error.message === "string" &&
		error.message.includes("closed database")
	);
}

export function createTaskId(): string {
	return randomUUID();
}

export function createTimestamp(now: () => string = () => new Date().toISOString()): string {
	return now();
}

export function parseTaskStatus(value: unknown): TaskStatus {
	return TaskStatusSchema.parse(value);
}

export function rowToBackgroundTask(row: BackgroundTaskRow): BackgroundTaskRecord {
	return Object.freeze({
		id: row.id,
		sessionId: row.session_id,
		description: row.description,
		category: row.category,
		status: parseTaskStatus(row.status),
		result: row.result,
		error: row.error,
		agent: row.agent,
		model: row.model,
		priority: row.priority,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		startedAt: row.started_at,
		completedAt: row.completed_at,
	});
}

export function getTaskByIdRow(db: Database, taskId: string): BackgroundTaskRecord | null {
	try {
		const row = db
			.query("SELECT * FROM background_tasks WHERE id = ?")
			.get(taskId) as BackgroundTaskRow | null;
		return row ? rowToBackgroundTask(row) : null;
	} catch (error: unknown) {
		if (isClosedDatabaseError(error)) {
			return null;
		}
		throw error;
	}
}

export interface ListBackgroundTasksFilters {
	readonly sessionId?: string;
	readonly status?: TaskStatus;
	readonly statuses?: readonly TaskStatus[];
	readonly limit?: number;
	readonly prioritizePending?: boolean;
}

export function listBackgroundTasks(
	db: Database,
	filters: ListBackgroundTasksFilters = {},
): readonly BackgroundTaskRecord[] {
	const conditions: string[] = [];
	const params: Array<string | number> = [];

	if (filters.sessionId) {
		conditions.push("session_id = ?");
		params.push(filters.sessionId);
	}

	if (filters.status) {
		conditions.push("status = ?");
		params.push(filters.status);
	}

	if (filters.statuses && filters.statuses.length > 0) {
		const placeholders = filters.statuses.map(() => "?").join(", ");
		conditions.push(`status IN (${placeholders})`);
		params.push(...filters.statuses);
	}

	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
	const orderBy = filters.prioritizePending
		? "ORDER BY priority DESC, created_at ASC, id ASC"
		: "ORDER BY created_at DESC, id DESC";
	const limitClause = typeof filters.limit === "number" ? " LIMIT ?" : "";
	const query = `SELECT * FROM background_tasks ${whereClause} ${orderBy}${limitClause}`;

	if (typeof filters.limit === "number") {
		params.push(filters.limit);
	}

	try {
		const rows = db.query(query).all(...params) as BackgroundTaskRow[];
		return Object.freeze(rows.map(rowToBackgroundTask));
	} catch (error: unknown) {
		if (isClosedDatabaseError(error)) {
			return Object.freeze([]);
		}
		throw error;
	}
}
