import { describe, expect, it } from "bun:test";
import { ContextMonitor } from "../../src/observability/context-monitor";
import {
	createObservabilityEventHandler,
	createToolExecuteAfterHandler,
	createToolExecuteBeforeHandler,
} from "../../src/observability/event-handlers";
import { SessionEventStore } from "../../src/observability/event-store";

describe("Hook Concurrency", () => {
	it("should handle 10 concurrent tool executions safely", async () => {
		const eventStore = new SessionEventStore();
		eventStore.initSession("test-session");
		const startTimes = new Map<string, number>();

		const beforeHandler = createToolExecuteBeforeHandler(startTimes);
		const afterHandler = createToolExecuteAfterHandler(eventStore, startTimes);

		const executions = Array.from({ length: 10 }).map((_, i) => {
			return new Promise<void>((resolve) => {
				setTimeout(() => {
					const callID = `call-${i}`;

					beforeHandler({
						tool: "oc_test",
						sessionID: "test-session",
						callID,
						args: { foo: "bar" },
					});

					setTimeout(() => {
						afterHandler(
							{
								tool: "oc_test",
								sessionID: "test-session",
								callID,
								args: { foo: "bar" },
							},
							{ title: "Success", output: "done", metadata: null },
						);
						resolve();
					}, Math.random() * 20);
				}, Math.random() * 10);
			});
		});

		await Promise.all(executions);

		const session = eventStore.getSession("test-session");
		expect(session?.events.length).toBe(10);
		expect(session?.events.every((e: any) => e.type === "tool_complete")).toBe(true);

		expect(startTimes.size).toBe(0);
	});

	it("should handle 10 concurrent observability events safely", async () => {
		const eventStore = new SessionEventStore();
		const contextMonitor = new ContextMonitor();

		let toastCount = 0;
		const deps = {
			eventStore,
			contextMonitor,
			showToast: async () => {
				toastCount++;
			},
			writeSessionLog: async () => {},
		};

		const handler = createObservabilityEventHandler(deps);

		await handler({
			event: {
				type: "session.created",
				properties: { info: { id: "test-session" } },
			},
		});

		const events = Array.from({ length: 10 }).map((_, i) => {
			return new Promise<void>((resolve) => {
				setTimeout(async () => {
					await handler({
						event: {
							type: "session.error",
							properties: {
								sessionID: "test-session",
								error: { message: `test error ${i}` },
							},
						},
					});
					resolve();
				}, Math.random() * 10);
			});
		});

		await Promise.all(events);

		const session = eventStore.getSession("test-session");
		expect(session?.events.length).toBe(11);
		expect(toastCount).toBe(0);
	});
});
