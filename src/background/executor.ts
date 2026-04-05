import type { Logger } from "../logging/types";
import type { TaskStatus } from "../types/background";
import type { BackgroundTaskRecord } from "./database";

export interface ExecuteTaskStatusPayload {
	readonly result?: string | null;
	readonly error?: string | null;
}

export interface ExecuteTaskDependencies {
	readonly updateStatus: (
		taskId: string,
		status: TaskStatus,
		payload?: ExecuteTaskStatusPayload,
	) => void | Promise<void>;
	readonly logger?: Logger;
	readonly wait?: (durationMs: number, signal: AbortSignal) => Promise<void>;
	readonly run?: (
		task: BackgroundTaskRecord,
		signal: AbortSignal,
	) => Promise<string | null | undefined>;
	readonly getTaskById?: (taskId: string) => BackgroundTaskRecord | null;
	readonly timeoutMs?: number;
	readonly executionDelayMs?: number;
	readonly pollIntervalMs?: number;
}

export interface ExecuteTaskResult {
	readonly taskId: string;
	readonly status: TaskStatus;
	readonly result?: string;
	readonly error?: string;
}

function createAbortError(message: string): Error {
	const error = new Error(message);
	Object.defineProperty(error, "name", { value: "AbortError" });
	return error;
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

async function defaultWait(durationMs: number, signal: AbortSignal): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason ?? createAbortError("Aborted"));
			return;
		}

		const timeoutId = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, durationMs);

		const onAbort = () => {
			clearTimeout(timeoutId);
			reject(signal.reason ?? createAbortError("Aborted"));
		};

		signal.addEventListener("abort", onAbort, { once: true });
	});
}

function getCancellationState(
	taskId: string,
	getTaskById?: (taskId: string) => BackgroundTaskRecord | null,
): BackgroundTaskRecord | null {
	if (!getTaskById) {
		return null;
	}

	const currentTask = getTaskById(taskId);
	return currentTask?.status === "cancelled" ? currentTask : null;
}

export async function executeTask(
	task: BackgroundTaskRecord,
	deps: ExecuteTaskDependencies,
): Promise<ExecuteTaskResult> {
	const logger = deps.logger;
	const cancelledBeforeStart = getCancellationState(task.id, deps.getTaskById);
	if (cancelledBeforeStart) {
		logger?.info("Background task already cancelled before execution", {
			backgroundTaskId: task.id,
		});
		return { taskId: task.id, status: "cancelled" };
	}

	await deps.updateStatus(task.id, "running");
	logger?.info("Background task started", { backgroundTaskId: task.id });

	const controller = new AbortController();
	const timeoutMs = deps.timeoutMs ?? 1_000;
	const executionDelayMs = deps.executionDelayMs ?? 10;
	const wait = deps.wait ?? defaultWait;
	const run =
		deps.run ??
		(async (currentTask: BackgroundTaskRecord, signal: AbortSignal) => {
			await wait(executionDelayMs, signal);
			return `Completed background task: ${currentTask.description}`;
		});

	let timedOut = false;
	const timeoutId = setTimeout(() => {
		timedOut = true;
		controller.abort(createAbortError(`Background task timed out after ${timeoutMs}ms`));
	}, timeoutMs);

	const pollIntervalMs = deps.pollIntervalMs ?? 10;
	const cancellationIntervalId = deps.getTaskById
		? setInterval(() => {
				const cancelledTask = getCancellationState(task.id, deps.getTaskById);
				if (cancelledTask && !controller.signal.aborted) {
					controller.abort(createAbortError("Background task cancelled"));
				}
			}, pollIntervalMs)
		: null;

	try {
		const result = await run(task, controller.signal);
		const cancelledTask = getCancellationState(task.id, deps.getTaskById);
		if (cancelledTask) {
			logger?.info("Background task cancelled during execution", {
				backgroundTaskId: task.id,
			});
			return { taskId: task.id, status: "cancelled" };
		}

		const message = result ?? `Completed background task: ${task.description}`;
		await deps.updateStatus(task.id, "completed", { result: message });
		logger?.info("Background task completed", { backgroundTaskId: task.id });
		return { taskId: task.id, status: "completed", result: message };
	} catch (error: unknown) {
		const cancelledTask = getCancellationState(task.id, deps.getTaskById);
		if (cancelledTask) {
			logger?.info("Background task observed cancellation", {
				backgroundTaskId: task.id,
			});
			return { taskId: task.id, status: "cancelled" };
		}

		if (timedOut && isAbortError(error)) {
			const message = error instanceof Error ? error.message : "Background task timed out";
			await deps.updateStatus(task.id, "failed", { error: message });
			logger?.error("Background task timed out", {
				backgroundTaskId: task.id,
				error: message,
			});
			return { taskId: task.id, status: "failed", error: message };
		}

		const message = error instanceof Error ? error.message : String(error);
		await deps.updateStatus(task.id, "failed", { error: message });
		logger?.error("Background task failed", {
			backgroundTaskId: task.id,
			error: message,
		});
		return { taskId: task.id, status: "failed", error: message };
	} finally {
		clearTimeout(timeoutId);
		if (cancellationIntervalId !== null) {
			clearInterval(cancellationIntervalId);
		}
	}
}
