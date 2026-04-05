import { describe, expect, mock, test } from "bun:test";
import { createRecoveryEventHandler } from "../../src/recovery/event-handler";
import { RecoveryOrchestrator } from "../../src/recovery/orchestrator";

describe("createRecoveryEventHandler", () => {
	test("session.error triggers recovery handling", async () => {
		const orchestrator = new RecoveryOrchestrator();
		const handler = createRecoveryEventHandler(orchestrator);

		await handler({
			event: {
				type: "session.error",
				properties: {
					sessionID: "sess-1",
					error: { message: "rate limit exceeded" },
				},
			},
		});

		const state = orchestrator.getState("sess-1");
		expect(state).not.toBeNull();
		expect(state?.attempts).toHaveLength(1);
	});

	test("session.deleted clears session state", async () => {
		const orchestrator = new RecoveryOrchestrator();
		orchestrator.handleError("sess-2", "network failure");
		const handler = createRecoveryEventHandler(orchestrator);

		await handler({
			event: {
				type: "session.deleted",
				properties: { info: { id: "sess-2" } },
			},
		});

		expect(orchestrator.getState("sess-2")).toBeNull();
	});

	test("never throws on orchestrator errors", async () => {
		const orchestrator = {
			handleError: mock(() => {
				throw new Error("boom");
			}),
			reset: mock(() => {}),
		} as unknown as RecoveryOrchestrator;
		const handler = createRecoveryEventHandler(orchestrator);

		await expect(
			handler({
				event: {
					type: "session.error",
					properties: { sessionID: "sess-3", error: "timeout" },
				},
			}),
		).resolves.toBeUndefined();
	});
});
