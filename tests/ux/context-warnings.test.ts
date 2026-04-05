import { describe, expect, test } from "bun:test";
import { ContextWarningMonitor } from "../../src/ux/context-warnings";
import { NotificationManager } from "../../src/ux/notifications";
import type { NotificationSink } from "../../src/ux/types";

class RecordingSink implements NotificationSink {
	readonly calls: Array<{
		readonly title: string;
		readonly message: string;
		readonly variant: string;
	}> = [];

	async showToast(title: string, message: string, variant: string): Promise<void> {
		this.calls.push({ title, message, variant });
	}
}

describe("ContextWarningMonitor", () => {
	test("triggers threshold warnings once per level", async () => {
		const sink = new RecordingSink();
		const manager = new NotificationManager({ sink, rateLimitMs: 0 });
		const monitor = new ContextWarningMonitor({ notificationManager: manager });

		monitor.checkUtilization(70, 100);
		await Promise.resolve();
		expect(monitor.getWarningLevel()).toBe("moderate");

		monitor.checkUtilization(72, 100);
		await Promise.resolve();

		monitor.checkUtilization(85, 100);
		await Promise.resolve();
		expect(monitor.getWarningLevel()).toBe("high");

		monitor.checkUtilization(96, 100);
		await Promise.resolve();
		expect(monitor.getWarningLevel()).toBe("critical");

		monitor.checkUtilization(99, 100);
		await Promise.resolve();

		expect(sink.calls).toEqual([
			{
				title: "Context warning",
				message: "Context at 70%, consider wrapping up",
				variant: "info",
			},
			{
				title: "Context warning",
				message: "Context at 85%, compaction recommended",
				variant: "warning",
			},
			{
				title: "Context warning",
				message: "Context at 95%, force compaction",
				variant: "error",
			},
		]);
	});

	test("returns none below the warning threshold", () => {
		const monitor = new ContextWarningMonitor();

		monitor.checkUtilization(69, 100);

		expect(monitor.getWarningLevel()).toBe("none");
	});
});
