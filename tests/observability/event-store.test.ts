import { describe, expect, it } from "bun:test";
import { type ObservabilityEvent, SessionEventStore } from "../../src/observability/event-store";

describe("Event Store Concurrency", () => {
	it("should handle 100 concurrent appendEvent calls without corruption", async () => {
		const store = new SessionEventStore();
		const sessionId = "test-session";
		store.initSession(sessionId);

		const appends = Array.from({ length: 100 }).map((_, i) => {
			return new Promise<void>((resolve) => {
				setTimeout(() => {
					const event: ObservabilityEvent = Object.freeze({
						type: "tool_complete",
						timestamp: new Date().toISOString(),
						sessionId,
						tool: `tool-${i}`,
						durationMs: 100,
						success: true,
					});
					store.appendEvent(sessionId, event);
					resolve();
				}, Math.random() * 10);
			});
		});

		await Promise.all(appends);

		const session = store.getSession(sessionId);
		expect(session).toBeDefined();
		expect(session?.events.length).toBe(100);

		const tools = new Set(session?.events.map((e) => (e as any).tool));
		expect(tools.size).toBe(100);
	});
});
