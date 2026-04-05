import { describe, expect, setSystemTime, test } from "bun:test";
import { NotificationManager } from "../../src/ux/notifications";
import type { NotificationSink } from "../../src/ux/types";

interface CapturedToast {
	readonly title: string;
	readonly message: string;
	readonly variant: string;
	readonly duration?: number;
}

class RecordingSink implements NotificationSink {
	readonly calls: CapturedToast[] = [];

	async showToast(
		title: string,
		message: string,
		variant: string,
		duration?: number,
	): Promise<void> {
		this.calls.push({ title, message, variant, duration });
	}
}

class ThrowingSink implements NotificationSink {
	async showToast(): Promise<void> {
		throw new Error("toast failed");
	}
}

describe("NotificationManager", () => {
	test("sends all toast variants to the sink", async () => {
		const sink = new RecordingSink();
		const manager = new NotificationManager({ sink, rateLimitMs: 5_000 });

		await manager.info("Info", "hello");
		await manager.success("Success", "done");
		await manager.warn("Warning", "careful");
		await manager.error("Error", "failed");

		expect(sink.calls).toEqual([
			{ title: "Info", message: "hello", variant: "info", duration: undefined },
			{ title: "Success", message: "done", variant: "success", duration: undefined },
			{ title: "Warning", message: "careful", variant: "warning", duration: undefined },
			{ title: "Error", message: "failed", variant: "error", duration: undefined },
		]);
	});

	test("rate limits per toast variant", async () => {
		setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
		const sink = new RecordingSink();
		const manager = new NotificationManager({ sink, rateLimitMs: 5_000 });

		await manager.warn("Warning", "first");
		await manager.warn("Warning", "second");
		await manager.info("Info", "other variant");

		setSystemTime(new Date("2026-01-01T00:00:05.001Z"));
		await manager.warn("Warning", "third");

		expect(sink.calls).toEqual([
			{ title: "Warning", message: "first", variant: "warning", duration: undefined },
			{ title: "Info", message: "other variant", variant: "info", duration: undefined },
			{ title: "Warning", message: "third", variant: "warning", duration: undefined },
		]);

		setSystemTime();
	});

	test("never throws when the sink fails", async () => {
		const manager = new NotificationManager({ sink: new ThrowingSink() });

		await expect(manager.error("Error", "still safe")).resolves.toBeUndefined();
	});
});
