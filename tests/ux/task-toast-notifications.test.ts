import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { notificationsDefaults, pluginConfigSchema } from "../../src/config";
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

describe("TaskToastManager desktop notifications", () => {
	let originalDateNow: typeof Date.now;
	let currentTime: number;
	let sink: RecordingSink;
	let notifications: NotificationManager;

	beforeEach(() => {
		originalDateNow = Date.now;
		currentTime = 1_704_067_200_000;
		Date.now = () => currentTime;
		sink = new RecordingSink();
		notifications = new NotificationManager({ sink, rateLimitMs: 0 });
	});

	afterEach(() => {
		Date.now = originalDateNow;
	});

	test("sends desktop notification when enabled", async () => {
		const sentNotifications: Array<readonly [string, string, string]> = [];
		const notificationSender = async (platform: string, title: string, message: string) => {
			sentNotifications.push([platform, title, message]);
		};
		const manager = new TaskToastManager(notifications, {
			desktopNotifications: { desktop: true, rateLimit: 5000 },
			notificationPlatform: "linux",
			notificationSender,
		});

		manager.showCompletionToast({
			id: "task-1",
			description: "Background build",
			duration: "12s",
		});

		await Promise.resolve();

		expect(sentNotifications).toEqual([
			["linux", "Task Completed", '"Background build" finished in 12s'],
		]);
		expect(sink.calls.at(-1)).toEqual({
			title: "Task Completed",
			message: '"Background build" finished in 12s',
			variant: "success",
			duration: 5000,
		});
	});

	test("skips desktop notification when disabled", async () => {
		const sentNotifications: Array<readonly [string, string, string]> = [];
		const notificationSender = async (platform: string, title: string, message: string) => {
			sentNotifications.push([platform, title, message]);
		};
		const manager = new TaskToastManager(notifications, {
			desktopNotifications: { desktop: false, rateLimit: 5000 },
			notificationPlatform: "linux",
			notificationSender,
		});

		manager.showCompletionToast({ id: "task-1", description: "Disabled", duration: "3s" });

		await Promise.resolve();

		expect(sentNotifications).toEqual([]);
	});

	test("rate-limits desktop notifications", async () => {
		const sentNotifications: Array<readonly [string, string, string]> = [];
		const notificationSender = async (platform: string, title: string, message: string) => {
			sentNotifications.push([platform, title, message]);
		};
		const manager = new TaskToastManager(notifications, {
			desktopNotifications: { desktop: true, rateLimit: 5000 },
			notificationPlatform: "linux",
			notificationSender,
		});

		manager.showCompletionToast({ id: "task-1", description: "First", duration: "1s" });
		await Promise.resolve();

		currentTime += 4_000;
		manager.showCompletionToast({ id: "task-2", description: "Second", duration: "2s" });
		await Promise.resolve();

		currentTime += 1_000;
		manager.showCompletionToast({ id: "task-3", description: "Third", duration: "3s" });
		await Promise.resolve();

		expect(sentNotifications).toEqual([
			["linux", "Task Completed", '"First" finished in 1s'],
			["linux", "Task Completed", '"Third" finished in 3s'],
		]);
	});

	test("swallows desktop notification failures", async () => {
		const notificationSender = mock(async () => {
			throw new Error("desktop failed");
		});
		const manager = new TaskToastManager(notifications, {
			desktopNotifications: { desktop: true, rateLimit: 5000 },
			notificationPlatform: "linux",
			notificationSender,
		});

		expect(() =>
			manager.showCompletionToast({ id: "task-1", description: "Failure", duration: "7s" }),
		).not.toThrow();

		await Promise.resolve();

		expect(notificationSender).toHaveBeenCalledTimes(1);
		expect(sink.calls.at(-1)?.title).toBe("Task Completed");
	});
});

describe("notifications config schema", () => {
	test("defaults notifications settings in v7 schema", () => {
		const parsed = pluginConfigSchema.parse({ version: 7, configured: false });

		expect(parsed.notifications).toEqual(notificationsDefaults);
	});

	test("createDefaultConfig-compatible defaults enable desktop notifications", () => {
		expect(notificationsDefaults).toEqual({ desktop: true, rateLimit: 5000 });
	});
});
