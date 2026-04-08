import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ContextMonitor } from "../../src/observability/context-monitor";
import {
	createObservabilityEventHandler,
	createToolExecuteAfterHandler,
	createToolExecuteBeforeHandler,
} from "../../src/observability/event-handlers";
import { SessionEventStore, type SessionEvents } from "../../src/observability/event-store";

describe("createObservabilityEventHandler", () => {
	let store: SessionEventStore;
	let contextMonitor: ContextMonitor;
	let showToast: ReturnType<typeof mock>;
	let writeSessionLog: ReturnType<typeof mock>;
	let handler: (input: { event: { type: string; [key: string]: unknown } }) => Promise<void>;

	beforeEach(() => {
		store = new SessionEventStore();
		contextMonitor = new ContextMonitor();
		showToast = mock(() => Promise.resolve());
		writeSessionLog = mock(() => Promise.resolve());
		handler = createObservabilityEventHandler({
			eventStore: store,
			contextMonitor,
			showToast,
			writeSessionLog,
		});
	});

	it("on session.created, inits session in store", async () => {
		await handler({
			event: {
				type: "session.created",
				properties: {
					info: {
						id: "sess-1",
						model: "anthropic/claude-sonnet-4-6",
					},
				},
			},
		});

		const session = store.getSession("sess-1");
		expect(session).toBeDefined();
		expect(session?.events.length).toBeGreaterThanOrEqual(1);
		expect(session?.events[0]?.type).toBe("session_start");
	});

	it("on session.error, appends error event with classified error type", async () => {
		store.initSession("sess-1");

		await handler({
			event: {
				type: "session.error",
				properties: {
					sessionID: "sess-1",
					error: { status: 429, message: "Rate limit exceeded" },
				},
			},
		});

		const session = store.getSession("sess-1");
		const errorEvents = session?.events.filter((e) => e.type === "error");
		expect(errorEvents?.length).toBe(1);

		const evt = errorEvents?.[0];
		if (evt?.type === "error") {
			expect(evt.errorType).toBe("rate_limit");
		}
	});

	it("on message.updated, accumulates tokens and checks context utilization", async () => {
		store.initSession("sess-1");
		contextMonitor.initSession("sess-1", 100000);

		await handler({
			event: {
				type: "message.updated",
				properties: {
					info: {
						sessionID: "sess-1",
						tokens: {
							input: 500,
							output: 200,
							reasoning: 50,
							cache: { read: 1000, write: 100 },
						},
						cost: 0.015,
					},
				},
			},
		});

		const session = store.getSession("sess-1");
		expect(session?.tokens.inputTokens).toBe(500);
		expect(session?.tokens.outputTokens).toBe(200);
		expect(session?.tokens.totalCost).toBeCloseTo(0.015);
		// Below threshold - no toast
		expect(showToast).not.toHaveBeenCalled();
	});

	it("on message.updated, fires toast when context exceeds 80%", async () => {
		store.initSession("sess-1");
		contextMonitor.initSession("sess-1", 10000);

		await handler({
			event: {
				type: "message.updated",
				properties: {
					info: {
						sessionID: "sess-1",
						tokens: {
							input: 8500,
							output: 200,
							reasoning: 0,
							cache: { read: 0, write: 0 },
						},
						cost: 0.01,
					},
				},
			},
		});

		expect(showToast).toHaveBeenCalledTimes(1);
		// Should have appended a context_warning event
		const session = store.getSession("sess-1");
		const warnings = session?.events.filter((e) => e.type === "context_warning");
		expect(warnings?.length).toBe(1);
	});

	it("on session.idle, snapshots to disk but keeps session in store", async () => {
		store.initSession("sess-1");
		store.appendEvent("sess-1", {
			type: "decision",
			timestamp: "2026-04-04T10:00:00.000Z",
			sessionId: "sess-1",
			phase: "BUILD",
			agent: "oc-implementer",
			decision: "Persist pending forensic evidence",
			rationale: "Idle flush should only write newly appended events",
		});

		await handler({
			event: {
				type: "session.idle",
				properties: {
					info: { sessionID: "sess-1" },
				},
			},
		});

		expect(writeSessionLog).toHaveBeenCalledTimes(1);
		// Session data should still be in store (snapshot, not flush)
		expect(store.getSession("sess-1")).toBeDefined();
	});

	it("on session.idle, does not write when no unpersisted events exist", async () => {
		store.initSession("sess-1");
		store.getUnpersistedSession("sess-1");

		await handler({
			event: {
				type: "session.idle",
				properties: {
					info: { sessionID: "sess-1" },
				},
			},
		});

		expect(writeSessionLog).not.toHaveBeenCalled();
		expect(store.getSession("sess-1")).toBeDefined();
	});

	it("on session.deleted, flushes remaining data and cleans up", async () => {
		store.initSession("sess-1");
		contextMonitor.initSession("sess-1", 100000);

		await handler({
			event: {
				type: "session.deleted",
				properties: {
					info: { id: "sess-1" },
				},
			},
		});

		expect(writeSessionLog).toHaveBeenCalledTimes(1);
		expect(store.getSession("sess-1")).toBeUndefined();
	});

	it("on session.deleted, session_end event has correct totalCost and durationMs", async () => {
		store.initSession("sess-1");
		contextMonitor.initSession("sess-1", 100000);

		// Accumulate some tokens first
		store.accumulateTokens("sess-1", {
			inputTokens: 100,
			outputTokens: 50,
			reasoningTokens: 25,
			cacheReadTokens: 10,
			cacheWriteTokens: 5,
			totalCost: 0.015,
			messageCount: 3,
		});

		// Get session to check startedAt
		const sessionBefore = store.getSession("sess-1");
		expect(sessionBefore).toBeDefined();

		// Mock Date constructor to return a fixed time
		const originalDate = global.Date;
		const startedAtTime = new Date(sessionBefore?.startedAt ?? "").getTime();
		const mockNowTime = startedAtTime + 5000; // 5 seconds later

		// Create a mock Date class
		class MockDate extends Date {
			constructor(value?: string | number | Date) {
				if (value === undefined) {
					super(mockNowTime);
				} else {
					super(value);
				}
			}

			static now() {
				return mockNowTime;
			}
		}

		global.Date = MockDate as typeof Date;

		try {
			await handler({
				event: {
					type: "session.deleted",
					properties: {
						info: { id: "sess-1" },
					},
				},
			});

			// Check that writeSessionLog was called with correct data
			expect(writeSessionLog).toHaveBeenCalledTimes(1);
			const loggedData = writeSessionLog.mock.calls[0][0] as SessionEvents | undefined;
			expect(loggedData).toBeDefined();

			// Find the session_end event
			const sessionEndEvent = loggedData?.events.find((e) => e.type === "session_end");
			expect(sessionEndEvent).toBeDefined();

			// TypeScript doesn't know that toBeDefined() guarantees non-null
			// so we need to check and cast
			if (!sessionEndEvent) {
				throw new Error("session_end event not found");
			}

			// Verify totalCost is not 0 (should be 0.015)
			expect(sessionEndEvent.totalCost).toBe(0.015);

			// Verify durationMs is calculated (should be 5000ms)
			expect(sessionEndEvent.durationMs).toBe(5000);
		} finally {
			global.Date = originalDate;
		}
	});

	it("handlers never modify output (pure observer)", async () => {
		store.initSession("sess-1");
		contextMonitor.initSession("sess-1", 100000);

		// The event handler only receives event data, not output objects
		// This test verifies the handler returns void and doesn't throw
		await expect(
			handler({
				event: {
					type: "message.updated",
					properties: {
						info: {
							sessionID: "sess-1",
							tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
							cost: 0.001,
						},
					},
				},
			}),
		).resolves.toBeUndefined();
	});
});

describe("createToolExecuteBeforeHandler", () => {
	it("records start timestamp keyed by callID", () => {
		const store = new SessionEventStore();
		store.initSession("sess-1");
		const startTimes = new Map<string, number>();
		const handler = createToolExecuteBeforeHandler(startTimes);

		handler({
			tool: "oc_review",
			sessionID: "sess-1",
			callID: "call-1",
			args: {},
		});

		expect(startTimes.has("call-1")).toBe(true);
		expect(typeof startTimes.get("call-1")).toBe("number");
	});
});

describe("createToolExecuteAfterHandler", () => {
	it("computes duration, records tool metric, appends event", () => {
		const store = new SessionEventStore();
		store.initSession("sess-1");
		const startTimes = new Map<string, number>();
		startTimes.set("call-1", Date.now() - 150); // 150ms ago

		const handler = createToolExecuteAfterHandler(store, startTimes);

		handler(
			{
				tool: "oc_review",
				sessionID: "sess-1",
				callID: "call-1",
				args: {},
			},
			{ title: "Review", output: "ok", metadata: {} },
		);

		// callID should be cleaned up
		expect(startTimes.has("call-1")).toBe(false);

		// Tool metrics should be recorded
		const session = store.getSession("sess-1");
		const metrics = session?.toolMetrics.get("oc_review");
		expect(metrics).toBeDefined();
		expect(metrics?.invocations).toBe(1);
		expect(metrics?.successes).toBe(1);
		expect(metrics?.totalDurationMs).toBeGreaterThanOrEqual(100);

		// tool_complete event appended
		const toolEvents = session?.events.filter((e) => e.type === "tool_complete");
		expect(toolEvents?.length).toBe(1);
	});

	it("records failure when output contains error indicators", () => {
		const store = new SessionEventStore();
		store.initSession("sess-1");
		const startTimes = new Map<string, number>();
		startTimes.set("call-2", Date.now() - 50);

		const handler = createToolExecuteAfterHandler(store, startTimes);

		handler(
			{
				tool: "oc_plan",
				sessionID: "sess-1",
				callID: "call-2",
				args: {},
			},
			{ title: "Error", output: "Error: something failed", metadata: { error: true } },
		);

		const session = store.getSession("sess-1");
		const metrics = session?.toolMetrics.get("oc_plan");
		expect(metrics?.failures).toBe(1);
		expect(metrics?.successes).toBe(0);
	});

	it("handles missing start time gracefully", () => {
		const store = new SessionEventStore();
		store.initSession("sess-1");
		const startTimes = new Map<string, number>();

		const handler = createToolExecuteAfterHandler(store, startTimes);

		// Should not throw even without a start time
		handler(
			{
				tool: "oc_state",
				sessionID: "sess-1",
				callID: "call-missing",
				args: {},
			},
			{ title: "State", output: "ok", metadata: {} },
		);

		const session = store.getSession("sess-1");
		const metrics = session?.toolMetrics.get("oc_state");
		expect(metrics?.invocations).toBe(1);
	});
});
