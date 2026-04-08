/**
 * Todo Sidebar Integration - OpenCode TUI Plugin
 *
 * Registers a todo sidebar component that displays pipeline and background tasks.
 * Integrates with the existing TaskToastManager and BackgroundManager systems.
 */

// TUI plugin types - these would come from @opencode-ai/plugin in production
// For now, define minimal types for development
interface TuiPluginApi {
	slots: {
		register: (plugin: any) => () => void;
	};
	event: {
		on: (type: string, handler: (event: any) => void) => () => void;
	};
	lifecycle: {
		onDispose: (handler: () => void) => void;
	};
}

interface TuiPluginMeta {
	sessionId: string;
}

type PluginOptions = any;

import type { TaskStatusItem } from "./task-status";
import type { BackgroundTaskRecord } from "../background/database";

/**
 * TUI Plugin for todo sidebar integration
 *
 * This plugin registers a sidebar component that displays:
 * 1. Pipeline tasks (from orchestrator pipeline)
 * 2. Background tasks (from background system)
 * 3. User todos (planned future feature via todowrite tool)
 */
export const todoSidebarTuiPlugin = async (
	api: TuiPluginApi,
	options: PluginOptions | undefined,
	meta: TuiPluginMeta,
): Promise<void> => {
	console.log(`[opencode-autopilot] Todo sidebar plugin loaded for session: ${meta.sessionId}`);

	// Register sidebar content component
	const unregisterSidebar = api.slots.register({
		id: "opencode-autopilot-todo-sidebar",
		render: (input: any) => {
			// The sidebar_content slot receives session_id as context
			const sessionId = input.params?.session_id ?? meta.sessionId;

			// This would render a SolidJS component in production
			// For now, return a simple placeholder indicating the component is active
			return {
				type: "div",
				props: {
					style: "color: #888; padding: 12px; font-style: italic;",
					children: [
						{
							type: "text",
							value: "OpenCode Autopilot: Todo sidebar component active. ",
						},
						{
							type: "text",
							value: `(Session: ${sessionId.slice(0, 8)}...)`,
						},
					],
				},
			};
		},
	});

	// Subscribe to task events for real-time updates
	const unsubscribeTasks = api.event.on("tool.execute.after", (event: any) => {
		// Monitor tools that affect task status
		const taskToolNames = ["oc_background", "oc_orchestrate", "oc_plan", "oc_state"];

		if (taskToolNames.includes(event.properties.tool)) {
			console.log(`[opencode-autopilot] Task-related tool executed: ${event.properties.tool}`);
			// In a full implementation, we would update the sidebar state here
			// by fetching fresh task data from the database
		}
	});

	// Clean up on plugin disposal
	api.lifecycle.onDispose(() => {
		unregisterSidebar();
		unsubscribeTasks();
		console.log("[opencode-autopilot] Todo sidebar plugin disposed");
	});
};

// Types and utilities for todo management
export interface TodoItem {
	readonly id: string;
	readonly content: string;
	readonly status: "pending" | "in_progress" | "completed" | "cancelled";
	readonly priority: "high" | "medium" | "low";
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface TodoSidebarOptions {
	readonly maxVisibleTodos?: number;
	readonly showCompleted?: boolean;
	readonly autoRefreshInterval?: number;
}

/**
 * TodoSidebarManager - Legacy manager class
 *
 * This is kept for backward compatibility but should be deprecated
 * in favor of the TUI plugin approach above.
 */
export class TodoSidebarManager {
	private todos: readonly TodoItem[] = [];
	private updateListeners: Array<(todos: readonly TodoItem[]) => void> = [];
	private refreshInterval?: NodeJS.Timeout;

	constructor(private readonly options: TodoSidebarOptions = {}) {}

	async initialize(): Promise<void> {
		// This is now handled by the TUI plugin
		console.warn(
			"TodoSidebarManager.initialize() is deprecated. Use todoSidebarTuiPlugin instead.",
		);
	}

	dispose(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = undefined;
		}
		this.updateListeners = [];
	}

	async updateTodos(todos: readonly TodoItem[]): Promise<void> {
		this.todos = [...todos];
		await this.notifyListeners();
	}

	getDisplayTodos(): readonly TodoItem[] {
		const { maxVisibleTodos = 10, showCompleted = false } = this.options;

		let filtered = this.todos;

		if (!showCompleted) {
			filtered = filtered.filter((todo) => todo.status !== "completed");
		}

		filtered = filtered.toSorted((a, b) => {
			const priorityOrder = { high: 0, medium: 1, low: 2 };
			const statusOrder = { in_progress: 0, pending: 1, completed: 2, cancelled: 3 };

			const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
			if (priorityDiff !== 0) return priorityDiff;

			const statusDiff = statusOrder[a.status] - statusOrder[b.status];
			if (statusDiff !== 0) return statusDiff;

			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});

		return filtered.slice(0, maxVisibleTodos);
	}

	getTodoStats(): {
		total: number;
		pending: number;
		inProgress: number;
		completed: number;
		highPriority: number;
	} {
		const todos = this.todos;
		return {
			total: todos.length,
			pending: todos.filter((t) => t.status === "pending").length,
			inProgress: todos.filter((t) => t.status === "in_progress").length,
			completed: todos.filter((t) => t.status === "completed").length,
			highPriority: todos.filter((t) => t.priority === "high").length,
		};
	}

	formatForDisplay(): string {
		const displayTodos = this.getDisplayTodos();
		const stats = this.getTodoStats();

		const lines: string[] = [];
		lines.push(`## Todos (${stats.inProgress} active, ${stats.pending} pending)`);
		lines.push("");

		if (displayTodos.length === 0) {
			lines.push("No todos to display.");
		} else {
			for (const todo of displayTodos) {
				const statusIcon = this.getStatusIcon(todo.status);
				const priorityIcon = this.getPriorityIcon(todo.priority);
				lines.push(`${statusIcon} ${priorityIcon} ${todo.content}`);
			}
		}

		if (stats.highPriority > 0) {
			lines.push("");
			lines.push(`⚠️  ${stats.highPriority} high priority todos`);
		}

		return lines.join("\n");
	}

	addUpdateListener(listener: (todos: readonly TodoItem[]) => void): void {
		this.updateListeners.push(listener);
	}

	removeUpdateListener(listener: (todos: readonly TodoItem[]) => void): void {
		this.updateListeners = this.updateListeners.filter((l) => l !== listener);
	}

	private async notifyListeners(): Promise<void> {
		const todos = this.todos;
		for (const listener of this.updateListeners) {
			try {
				listener(todos);
			} catch (error) {
				console.error("Todo update listener error:", error);
			}
		}
	}

	private getStatusIcon(status: TodoItem["status"]): string {
		switch (status) {
			case "in_progress":
				return "🔄";
			case "completed":
				return "✅";
			case "cancelled":
				return "❌";
			case "pending":
				return "⏳";
			default:
				return "📝";
		}
	}

	private getPriorityIcon(priority: TodoItem["priority"]): string {
		switch (priority) {
			case "high":
				return "🔴";
			case "medium":
				return "🟡";
			case "low":
				return "🟢";
			default:
				return "⚪";
		}
	}

	/**
	 * Convert from TaskStatusItem to TodoItem
	 */
	static fromTaskStatus(taskStatus: TaskStatusItem): TodoItem {
		return {
			id: taskStatus.id,
			content: taskStatus.description,
			status: taskStatus.status as TodoItem["status"],
			priority: "medium",
			createdAt: taskStatus.createdAt,
			updatedAt: new Date().toISOString(),
		};
	}

	/**
	 * Convert from BackgroundTaskRecord to TodoItem
	 */
	static fromBackgroundTask(record: BackgroundTaskRecord): TodoItem {
		return {
			id: record.id,
			content: record.description,
			status: this.mapBackgroundStatus(record.status),
			priority: this.mapPriority(record.priority),
			createdAt: record.createdAt,
			updatedAt: record.updatedAt,
		};
	}

	private static mapBackgroundStatus(status: BackgroundTaskRecord["status"]): TodoItem["status"] {
		switch (status) {
			case "running":
				return "in_progress";
			case "pending":
				return "pending";
			case "completed":
				return "completed";
			case "failed":
			case "cancelled":
				return "cancelled";
			default:
				return "pending";
		}
	}

	private static mapPriority(priority: number): TodoItem["priority"] {
		if (priority >= 75) return "high";
		if (priority >= 50) return "medium";
		return "low";
	}
}
