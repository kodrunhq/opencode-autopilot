import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	clearCompactionTracking,
	createPreemptiveCompactionHandler,
} from "../../src/hooks/preemptive-compaction";

function makeShowToast() {
	return mock((_title: string, _message: string, _variant: "info" | "warning" | "error") =>
		Promise.resolve(),
	);
}

function makeHookInput(sessionID: string, used?: number, limit?: number) {
	return {
		sessionID,
		tokens: used !== undefined && limit !== undefined ? { used, limit } : undefined,
	};
}

describe("createPreemptiveCompactionHandler", () => {
	beforeEach(() => {
		clearCompactionTracking();
	});

	afterEach(() => {
		clearCompactionTracking();
	});

	it("returns a function", () => {
		const handler = createPreemptiveCompactionHandler({ showToast: makeShowToast() });
		expect(typeof handler).toBe("function");
	});

	it("triggers warning toast when context usage exceeds default threshold (80%)", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast });

		await handler(makeHookInput("s1", 85000, 100000), undefined);

		expect(showToast).toHaveBeenCalledTimes(1);
		const [title, message, variant] = showToast.mock.lastCall ?? [];
		expect(title).toBe("Context warning");
		expect(message).toContain("85%");
		expect(variant).toBe("info");
	});

	it("triggers warning toast when usage is exactly at the threshold", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast, thresholdPercent: 80 });

		await handler(makeHookInput("s1", 80000, 100000), undefined);

		expect(showToast).toHaveBeenCalledTimes(1);
	});

	it("does not trigger toast when usage is below threshold", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast, thresholdPercent: 80 });

		await handler(makeHookInput("s1", 79000, 100000), undefined);

		expect(showToast).not.toHaveBeenCalled();
	});

	it("does not trigger toast when usage is well below threshold", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast });

		await handler(makeHookInput("s1", 10000, 100000), undefined);

		expect(showToast).not.toHaveBeenCalled();
	});

	it("respects custom threshold percent", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast, thresholdPercent: 50 });

		await handler(makeHookInput("s1", 51000, 100000), undefined);

		expect(showToast).toHaveBeenCalledTimes(1);
	});

	it("does not trigger below custom threshold", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast, thresholdPercent: 50 });

		await handler(makeHookInput("s1", 49000, 100000), undefined);

		expect(showToast).not.toHaveBeenCalled();
	});

	it("does not spam: second call above threshold for same session does not fire toast again", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast });

		await handler(makeHookInput("s1", 85000, 100000), undefined);
		await handler(makeHookInput("s1", 90000, 100000), undefined);

		expect(showToast).toHaveBeenCalledTimes(1);
	});

	it("fires toast again for same session after usage drops below threshold then rises again", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast });

		await handler(makeHookInput("s1", 85000, 100000), undefined);
		await handler(makeHookInput("s1", 50000, 100000), undefined);
		await handler(makeHookInput("s1", 85000, 100000), undefined);

		expect(showToast).toHaveBeenCalledTimes(2);
	});

	it("handles different sessions independently", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast });

		await handler(makeHookInput("session-A", 85000, 100000), undefined);
		await handler(makeHookInput("session-B", 85000, 100000), undefined);

		expect(showToast).toHaveBeenCalledTimes(2);
	});

	it("does not trigger when tokens are missing", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast });

		await handler({ sessionID: "s1" }, undefined);

		expect(showToast).not.toHaveBeenCalled();
	});

	it("does not trigger when limit is zero", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast });

		await handler(makeHookInput("s1", 85000, 0), undefined);

		expect(showToast).not.toHaveBeenCalled();
	});

	it("clearCompactionTracking() resets warned state so toast fires again", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast });

		await handler(makeHookInput("s1", 85000, 100000), undefined);
		clearCompactionTracking();
		await handler(makeHookInput("s1", 85000, 100000), undefined);

		expect(showToast).toHaveBeenCalledTimes(2);
	});

	it("falls back to default threshold when thresholdPercent is NaN", async () => {
		const showToast = makeShowToast();
		const handler = createPreemptiveCompactionHandler({ showToast, thresholdPercent: Number.NaN });

		await handler(makeHookInput("s1", 85000, 100000), undefined);

		expect(showToast).toHaveBeenCalledTimes(1);
	});
});
