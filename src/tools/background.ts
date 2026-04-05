import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { BackgroundManager } from "../background/manager";
import { openKernelDb } from "../kernel/database";
import type { TaskStatus } from "../types/background";

const backgroundActionSchema = z.enum(["spawn", "status", "list", "cancel", "result"]);

interface BackgroundToolOptions {
	readonly sessionId?: string;
	readonly taskId?: string;
	readonly description?: string;
	readonly category?: string;
	readonly agent?: string;
	readonly priority?: number;
	readonly status?: TaskStatus;
}

let defaultManager: BackgroundManager | null = null;

function getDefaultManager(): BackgroundManager {
	if (defaultManager) {
		return defaultManager;
	}

	defaultManager = new BackgroundManager({ db: openKernelDb() });
	return defaultManager;
}

function createDisplayText(title: string, lines: readonly string[]): string {
	return [title, ...lines].join("\n");
}

export async function backgroundCore(
	action: z.infer<typeof backgroundActionSchema>,
	options: BackgroundToolOptions = {},
	db?: Database,
): Promise<string> {
	const isTransientManager = db !== undefined;
	const manager = isTransientManager ? new BackgroundManager({ db }) : getDefaultManager();

	try {
		switch (action) {
			case "spawn": {
				if (!options.description) {
					return JSON.stringify({ action: "error", message: "description required" });
				}

				const taskId = manager.spawn(options.sessionId ?? "unknown-session", options.description, {
					category: options.category,
					agent: options.agent,
					priority: options.priority,
				});
				if (isTransientManager) {
					await manager.waitForIdle();
				}
				const task = manager.getStatus(taskId);
				return JSON.stringify({
					action: "background_spawn",
					task,
					displayText: createDisplayText("Background task queued", [
						`Task ID: ${taskId}`,
						`Session: ${options.sessionId ?? "unknown-session"}`,
						`Description: ${options.description}`,
					]),
				});
			}

			case "status": {
				if (!options.taskId) {
					return JSON.stringify({ action: "error", message: "taskId required" });
				}

				const task = manager.getStatus(options.taskId);
				if (!task) {
					return JSON.stringify({
						action: "error",
						message: `Task '${options.taskId}' not found.`,
					});
				}

				return JSON.stringify({
					action: "background_status",
					task,
					displayText: createDisplayText("Background task status", [
						`Task ID: ${task.id}`,
						`Status: ${task.status}`,
						`Description: ${task.description}`,
					]),
				});
			}

			case "list": {
				const tasks = manager.list(options.sessionId, options.status);
				const taskLines =
					tasks.length > 0
						? tasks.map((task) => `${task.id} | ${task.status} | ${task.description}`)
						: ["No background tasks found."];
				return JSON.stringify({
					action: "background_list",
					tasks,
					displayText: createDisplayText("Background tasks", taskLines),
				});
			}

			case "cancel": {
				if (!options.taskId) {
					return JSON.stringify({ action: "error", message: "taskId required" });
				}

				const cancelled = manager.cancel(options.taskId);
				const task = manager.getStatus(options.taskId);
				return JSON.stringify({
					action: "background_cancel",
					cancelled,
					task,
					displayText: createDisplayText("Background cancel", [
						`Task ID: ${options.taskId}`,
						cancelled ? "Cancelled." : "Task could not be cancelled.",
					]),
				});
			}

			case "result": {
				if (!options.taskId) {
					return JSON.stringify({ action: "error", message: "taskId required" });
				}

				const result = manager.getResult(options.taskId);
				if (!result) {
					return JSON.stringify({
						action: "error",
						message: `Task '${options.taskId}' not found.`,
					});
				}

				return JSON.stringify({
					action: "background_result",
					result,
					displayText: createDisplayText("Background task result", [
						`Task ID: ${options.taskId}`,
						`Status: ${result.status}`,
						`Result: ${result.result ?? "<none>"}`,
						`Error: ${result.error ?? "<none>"}`,
					]),
				});
			}
		}
	} finally {
		if (isTransientManager && action === "spawn") {
			await manager.dispose();
		}
	}

	return JSON.stringify({ action: "error", message: `Unsupported action: ${action}` });
}

export const ocBackground = tool({
	description:
		"Manage background tasks. Actions: spawn, status, list, cancel, result. Returns JSON with displayText for presentation.",
	args: {
		action: backgroundActionSchema.describe("Background task action"),
		sessionId: z.string().min(1).optional().describe("Session ID to scope tasks to"),
		taskId: z.string().min(1).optional().describe("Background task ID"),
		description: z.string().min(1).optional().describe("Background task description for spawn"),
		category: z.string().min(1).optional().describe("Optional task category for spawn/list"),
		agent: z.string().min(1).optional().describe("Optional agent hint for spawn"),
		priority: z.number().int().min(0).max(100).optional().describe("Optional task priority"),
		status: z
			.enum(["pending", "running", "completed", "failed", "cancelled"])
			.optional()
			.describe("Optional status filter for list"),
	},
	async execute(
		{ action, sessionId, taskId, description, category, agent, priority, status },
		context,
	) {
		return backgroundCore(action, {
			sessionId: sessionId ?? context.sessionID,
			taskId,
			description,
			category,
			agent,
			priority,
			status,
		});
	},
});
