import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime } from "bun:test";
import { NotificationManager } from "../../src/ux/notifications";
import { TaskToastManager } from "../../src/ux/task-toast-manager";
import type { NotificationSink } from "../../src/ux/types";

interface ToastCall {
	readonly title: string;
	readonly message: string;
	readonly variant: string;
	readonly duration?: number;
}

class RecordingSink implements NotificationSink {
	readonly calls: ToastCall[] = [];
	readonly showToast = mock(
		async (title: string, message: string, variant: string, duration?: number) => {
			this.calls.push({ title, message, variant, duration });
		},
	);
}

describe("TaskToastManager", () => {
	let sink: RecordingSink;
	let notifications: NotificationManager;
	let manager: TaskToastManager;

	beforeEach(() => {
		setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		sink = new RecordingSink();
		notifications = new NotificationManager({ sink, rateLimitMs: 0 });
		manager = new TaskToastManager(notifications);
	});

	afterEach(() => {
		setSystemTime();
	});

	it("creates with a notification sink", () => {
		expect(manager).toBeInstanceOf(TaskToastManager);
		expect(sink.calls).toEqual([]);
	});

	it("adds a task and shows a consolidated toast", () => {
		manager.addTask({
			id: "task-1",
			description: "Build pipeline",
			agent: "planner",
			isBackground: true,
		});

		expect(sink.calls).toEqual([
			{
				title: "New Background Task",
				message: "Running (1):\n[BG] Build pipeline (planner) - 0s ← NEW",
				variant: "info",
				duration: 3000,
			},
		]);
	});

	it("transitions task status from queued to running to completed", () => {
		manager.addTask({
			id: "task-1",
			description: "Compile",
			agent: "builder",
			isBackground: false,
			status: "queued",
		});
		manager.updateStatus("task-1", "running");

		expect(manager.getRunningTasks().map((task) => task.id)).toEqual(["task-1"]);
		expect(manager.getQueuedTasks()).toEqual([]);

		manager.updateStatus("task-1", "completed");

		expect(manager.getRunningTasks()).toEqual([]);
		expect(manager.getQueuedTasks()).toEqual([]);
	});

	it("associates model info with session tasks", () => {
		manager.addTask({
			id: "task-1",
			sessionId: "session-1",
			description: "Review code",
			agent: "reviewer",
			isBackground: true,
		});

		manager.updateModelBySession("session-1", {
			model: "openai/gpt-4.1",
			type: "inherited",
		});

		expect(sink.calls.at(-1)).toEqual({
			title: "New Background Task",
			message:
				"[FALLBACK] Model: openai/gpt-4.1 (inherited from parent)\n\nRunning (1):\n[BG] Review code (gpt-4.1) - 0s ← NEW",
			variant: "info",
			duration: 3000,
		});
	});

	it("removes a task from tracking", () => {
		manager.addTask({
			id: "task-1",
			description: "Ship it",
			agent: "shipper",
			isBackground: false,
		});

		manager.removeTask("task-1");

		expect(manager.getRunningTasks()).toEqual([]);
		expect(manager.getQueuedTasks()).toEqual([]);
	});

	it("shows completion toast with remaining task counts", () => {
		manager.addTask({
			id: "task-1",
			description: "Running task",
			agent: "builder",
			isBackground: false,
		});
		manager.addTask({
			id: "task-2",
			description: "Queued task",
			agent: "planner",
			isBackground: true,
			status: "queued",
		});

		manager.showCompletionToast({
			id: "task-1",
			description: "Running task",
			duration: "42s",
		});

		expect(sink.calls.at(-1)).toEqual({
			title: "Task Completed",
			message: '"Running task" finished in 42s\n\nStill running: 0 | Queued: 1',
			variant: "success",
			duration: 5000,
		});
	});

	it("returns currently running tasks in newest-first order", () => {
		setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		manager.addTask({ id: "task-1", description: "First", agent: "a", isBackground: false });
		setSystemTime(new Date("2026-01-01T00:00:10.000Z"));
		manager.addTask({ id: "task-2", description: "Second", agent: "b", isBackground: false });
		manager.updateStatus("task-1", "running");
		manager.updateStatus("task-2", "running");

		expect(manager.getRunningTasks().map((task) => task.id)).toEqual(["task-2", "task-1"]);
	});

	it("returns currently queued tasks in oldest-first order", () => {
		setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		manager.addTask({
			id: "task-1",
			description: "First",
			agent: "a",
			isBackground: false,
			status: "queued",
		});
		setSystemTime(new Date("2026-01-01T00:00:10.000Z"));
		manager.addTask({
			id: "task-2",
			description: "Second",
			agent: "b",
			isBackground: false,
			status: "queued",
		});

		expect(manager.getQueuedTasks().map((task) => task.id)).toEqual(["task-1", "task-2"]);
	});

	it("shows a consolidated toast for combined running and queued tasks", () => {
		manager.addTask({ id: "task-1", description: "Run 1", agent: "runner", isBackground: false });
		manager.addTask({
			id: "task-2",
			description: "Queue 1",
			agent: "planner",
			isBackground: true,
			status: "queued",
		});
		manager.addTask({ id: "task-3", description: "Run 2", agent: "runner", isBackground: false });

		expect(sink.calls.at(-1)).toEqual({
			title: "New Task Executed",
			message:
				"Running (2):\n[RUN] Run 1 (runner) - 0s\n[RUN] Run 2 (runner) - 0s ← NEW\n\nQueued (1):\n[Q] Queue 1 (planner) - Queued",
			variant: "info",
			duration: 5000,
		});
	});

	it("formats a readable task list message", () => {
		manager.addTask({
			id: "task-1",
			description: "Fallback task",
			agent: "builder",
			isBackground: false,
			category: "build",
			skills: ["typescript", "testing"],
			modelInfo: { model: "openai/gpt-4.1", type: "runtime-fallback" },
		});
		manager.addTask({
			id: "task-2",
			description: "Queued task",
			agent: "planner",
			isBackground: true,
			status: "queued",
		});

		const buildTaskListMessage = Reflect.get(manager, "buildTaskListMessage");
		const task = Reflect.get(manager, "tasks").get("task-1");
		if (!task) throw new Error("expected task to exist");

		expect(buildTaskListMessage.call(manager, task)).toBe(
			"[FALLBACK] Model: openai/gpt-4.1 (runtime fallback)\n\nRunning (1):\n[RUN] Fallback task (gpt-4.1: build) [typescript, testing] - 0s ← NEW\n\nQueued (1):\n[Q] Queued task (planner) - Queued",
		);
	});

	it("identifies fallback models and suffixes", () => {
		const isFallbackModel = Reflect.get(manager, "isFallbackModel");
		const getFallbackSuffix = Reflect.get(manager, "getFallbackSuffix");

		const baseTask = {
			id: "task-x",
			description: "Task",
			agent: "agent",
			isBackground: false,
			status: "running" as const,
			startedAt: new Date("2026-01-01T00:00:00.000Z"),
		};

		expect(
			isFallbackModel.call(manager, { ...baseTask, modelInfo: { model: "x", type: "inherited" } }),
		).toBe(true);
		expect(
			isFallbackModel.call(manager, {
				...baseTask,
				modelInfo: { model: "x", type: "system-default" },
			}),
		).toBe(true);
		expect(
			isFallbackModel.call(manager, {
				...baseTask,
				modelInfo: { model: "x", type: "runtime-fallback" },
			}),
		).toBe(true);
		expect(
			isFallbackModel.call(manager, {
				...baseTask,
				modelInfo: { model: "x", type: "user-defined" },
			}),
		).toBe(false);

		expect(getFallbackSuffix("inherited")).toBe(" (inherited from parent)");
		expect(getFallbackSuffix("system-default")).toBe(" (system default fallback)");
		expect(getFallbackSuffix("runtime-fallback")).toBe(" (runtime fallback)");
		expect(getFallbackSuffix("user-defined")).toBe("");
	});

	it("formats task identifiers", () => {
		const formatTaskIdentifier = Reflect.get(manager, "formatTaskIdentifier");
		const baseTask = {
			id: "task-x",
			description: "Task",
			agent: "agent",
			isBackground: false,
			status: "running" as const,
			startedAt: new Date("2026-01-01T00:00:00.000Z"),
		};

		expect(
			formatTaskIdentifier.call(manager, {
				...baseTask,
				agent: "builder",
				category: "build",
				modelInfo: { model: "openai/gpt-4.1", type: "user-defined" },
			}),
		).toBe("gpt-4.1: build");
		expect(
			formatTaskIdentifier.call(manager, {
				...baseTask,
				agent: "builder",
				modelInfo: { model: "openai/gpt-4.1", type: "user-defined" },
			}),
		).toBe("gpt-4.1");
		expect(
			formatTaskIdentifier.call(manager, { ...baseTask, agent: "builder", category: "build" }),
		).toBe("builder/build");
		expect(formatTaskIdentifier.call(manager, { ...baseTask, agent: "builder" })).toBe("builder");
	});

	it("formats durations into readable strings", () => {
		const formatDuration = Reflect.get(manager, "formatDuration");
		const now = new Date("2026-01-01T02:00:00.000Z");
		setSystemTime(now);

		expect(formatDuration.call(manager, new Date("2026-01-01T01:59:50.000Z"))).toBe("10s");
		expect(formatDuration.call(manager, new Date("2026-01-01T01:58:30.000Z"))).toBe("1m 30s");
		expect(formatDuration.call(manager, new Date("2026-01-01T00:00:00.000Z"))).toBe("2h 0m");
	});

	it("handles empty task lists and unknown task ids", () => {
		const buildTaskListMessage = Reflect.get(manager, "buildTaskListMessage");
		const missingTask = {
			id: "missing",
			description: "Missing",
			agent: "none",
			isBackground: false,
			status: "running" as const,
			startedAt: new Date("2026-01-01T00:00:00.000Z"),
		};

		expect(buildTaskListMessage.call(manager, missingTask)).toBe("");

		expect(() => manager.updateStatus("missing", "completed")).not.toThrow();
		expect(() => manager.removeTask("missing")).not.toThrow();
		expect(manager.getRunningTasks()).toEqual([]);
		expect(manager.getQueuedTasks()).toEqual([]);
	});

	it("replaces an existing task when the same id is added twice", () => {
		manager.addTask({
			id: "task-1",
			description: "Original",
			agent: "builder",
			isBackground: false,
		});
		manager.addTask({
			id: "task-1",
			description: "Updated",
			agent: "builder",
			isBackground: false,
		});

		expect(manager.getRunningTasks().map((task) => task.description)).toEqual(["Updated"]);
		expect(sink.calls.at(-1)?.message).toContain("Updated");
	});
});
