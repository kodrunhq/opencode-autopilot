import type { Database } from "bun:sqlite";
import { withTransaction } from "../kernel/transaction";
import type { TaskStatus } from "../types/background";
import {
	type BackgroundTaskRecord,
	type BackgroundTaskResultRecord,
	type CreateBackgroundTaskInput,
	createTaskId,
	createTimestamp,
	getTaskByIdRow,
	listBackgroundTasks,
} from "./database";
import { assertTransition } from "./state-machine";

export interface TaskUpdatePayload {
	readonly result?: string | null;
	readonly error?: string | null;
	readonly now?: string;
}

export function createTask(db: Database, task: CreateBackgroundTaskInput): BackgroundTaskRecord {
	return withTransaction(db, () => {
		const timestamp = task.createdAt ?? createTimestamp();
		const nextTask = Object.freeze({
			id: task.id ?? createTaskId(),
			sessionId: task.sessionId,
			description: task.description,
			category: task.category ?? null,
			status: task.status ?? "pending",
			result: task.result ?? null,
			error: task.error ?? null,
			agent: task.agent ?? null,
			model: task.model ?? null,
			priority: task.priority ?? 50,
			createdAt: timestamp,
			updatedAt: task.updatedAt ?? timestamp,
			startedAt: task.startedAt ?? null,
			completedAt: task.completedAt ?? null,
		});

		db.run(
			`INSERT INTO background_tasks (
				id, session_id, description, category, status, result, error, agent, model, priority,
				created_at, updated_at, started_at, completed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				nextTask.id,
				nextTask.sessionId,
				nextTask.description,
				nextTask.category,
				nextTask.status,
				nextTask.result,
				nextTask.error,
				nextTask.agent,
				nextTask.model,
				nextTask.priority,
				nextTask.createdAt,
				nextTask.updatedAt,
				nextTask.startedAt,
				nextTask.completedAt,
			],
		);

		const createdTask = getTaskByIdRow(db, nextTask.id);
		if (!createdTask) {
			throw new Error(`Failed to create background task '${nextTask.id}'`);
		}

		return createdTask;
	});
}

export function updateStatus(
	db: Database,
	taskId: string,
	newStatus: TaskStatus,
	payload: TaskUpdatePayload = {},
): BackgroundTaskRecord {
	return withTransaction(db, () => {
		const currentTask = getTaskByIdRow(db, taskId);
		if (!currentTask) {
			throw new Error(`Background task '${taskId}' not found`);
		}

		assertTransition(currentTask.status, newStatus);

		const timestamp = payload.now ?? createTimestamp();
		const startedAt =
			newStatus === "running" ? (currentTask.startedAt ?? timestamp) : currentTask.startedAt;
		const completedAt =
			newStatus === "completed" || newStatus === "failed" || newStatus === "cancelled"
				? timestamp
				: currentTask.completedAt;
		const result =
			newStatus === "completed" ? (payload.result ?? currentTask.result) : currentTask.result;
		const error = newStatus === "failed" ? (payload.error ?? currentTask.error) : null;

		db.run(
			`UPDATE background_tasks
			 SET status = ?, result = ?, error = ?, updated_at = ?, started_at = ?, completed_at = ?
			 WHERE id = ?`,
			[newStatus, result, error, timestamp, startedAt, completedAt, taskId],
		);

		const updatedTask = getTaskByIdRow(db, taskId);
		if (!updatedTask) {
			throw new Error(`Failed to update background task '${taskId}'`);
		}

		return updatedTask;
	});
}

export function getActiveTasks(db: Database, sessionId?: string): readonly BackgroundTaskRecord[] {
	return listBackgroundTasks(db, {
		sessionId,
		statuses: ["pending", "running"],
		prioritizePending: true,
	});
}

export function getTaskById(db: Database, taskId: string): BackgroundTaskRecord | null {
	return getTaskByIdRow(db, taskId);
}

export function getTaskResult(db: Database, taskId: string): BackgroundTaskResultRecord | null {
	const task = getTaskByIdRow(db, taskId);
	if (!task) {
		return null;
	}

	return Object.freeze({
		status: task.status,
		result: task.result,
		error: task.error,
		completedAt: task.completedAt,
	});
}

export function cancelTask(db: Database, taskId: string): BackgroundTaskRecord | null {
	const task = getTaskByIdRow(db, taskId);
	if (!task) {
		return null;
	}

	if (task.status !== "pending" && task.status !== "running") {
		return task;
	}

	return updateStatus(db, taskId, "cancelled");
}

export function countByStatus(db: Database, status: TaskStatus): number {
	const row = db
		.query("SELECT COUNT(*) as count FROM background_tasks WHERE status = ?")
		.get(status) as { count?: number } | null;
	return row?.count ?? 0;
}

export function enforceMaxConcurrent(db: Database, maxConcurrent: number): void {
	const runningCount = countByStatus(db, "running");
	if (runningCount >= maxConcurrent) {
		throw new Error(
			`Background concurrency limit reached: ${runningCount} running task(s), max ${maxConcurrent}`,
		);
	}
}

export function listTasks(
	db: Database,
	filters: { readonly sessionId?: string; readonly status?: TaskStatus } = {},
): readonly BackgroundTaskRecord[] {
	return listBackgroundTasks(db, filters);
}
