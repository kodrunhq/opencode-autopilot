import { beforeEach, describe, expect, test } from "bun:test";
import type { FallbackState } from "../../../src/orchestrator/fallback/types";

// Minimal mock for FallbackManager
function createMockManager() {
	const calls: Array<{ method: string; args: unknown[] }> = [];

	const states = new Map<string, FallbackState>();
	let dispatchInFlight = false;
	let compactionInFlight = false;
	let tryRecoverResult = false;

	return {
		calls,
		states,
		setDispatchInFlight(value: boolean) {
			dispatchInFlight = value;
		},
		setCompactionInFlight(value: boolean) {
			compactionInFlight = value;
		},
		setTryRecoverResult(value: boolean) {
			tryRecoverResult = value;
		},
		getSessionState(sessionID: string) {
			calls.push({ method: "getSessionState", args: [sessionID] });
			return states.get(sessionID);
		},
		isDispatchInFlight(sessionID: string) {
			calls.push({ method: "isDispatchInFlight", args: [sessionID] });
			return dispatchInFlight;
		},
		isCompactionInFlight(sessionID: string) {
			calls.push({ method: "isCompactionInFlight", args: [sessionID] });
			return compactionInFlight;
		},
		tryRecoverToOriginal(sessionID: string) {
			calls.push({ method: "tryRecoverToOriginal", args: [sessionID] });
			return tryRecoverResult;
		},
	};
}

function createFallbackState(overrides: Partial<FallbackState> = {}): FallbackState {
	return {
		originalModel: "anthropic/claude-sonnet-4-5",
		currentModel: "anthropic/claude-sonnet-4-5",
		fallbackIndex: -1,
		failedModels: new Map(),
		attemptCount: 0,
		...overrides,
	};
}

describe("createChatMessageHandler", () => {
	let mockManager: ReturnType<typeof createMockManager>;
	let createChatMessageHandler: unknown;

	beforeEach(async () => {
		mockManager = createMockManager();
		const mod = await import("../../../src/orchestrator/fallback/chat-message-handler");
		createChatMessageHandler = mod.createChatMessageHandler;
	});

	test("when no fallback state exists, does not modify output", async () => {
		const handler = createChatMessageHandler(mockManager as unknown);

		const output = {
			message: { model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" } },
			parts: [],
		};

		await handler({ sessionID: "sess-1" }, output);

		expect(output.message.model).toEqual({ providerID: "anthropic", modelID: "claude-sonnet-4-5" });
	});

	test("when currentModel equals originalModel, does not modify output", async () => {
		mockManager.states.set("sess-1", createFallbackState());
		const handler = createChatMessageHandler(mockManager as unknown);

		const output = {
			message: { model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" } },
			parts: [],
		};

		await handler({ sessionID: "sess-1" }, output);

		expect(output.message.model).toEqual({ providerID: "anthropic", modelID: "claude-sonnet-4-5" });
	});

	test("when currentModel differs from originalModel, sets output.message.model to fallback", async () => {
		mockManager.states.set(
			"sess-1",
			createFallbackState({
				currentModel: "openai/gpt-5",
				fallbackIndex: 0,
				attemptCount: 1,
			}),
		);
		const handler = createChatMessageHandler(mockManager as unknown);

		const output = {
			message: { model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" } },
			parts: [],
		};

		await handler({ sessionID: "sess-1" }, output);

		expect(output.message.model).toEqual({ providerID: "openai", modelID: "gpt-5" });
	});

	test("when dispatch is in flight, does not modify output (Pitfall 3)", async () => {
		mockManager.states.set(
			"sess-1",
			createFallbackState({
				currentModel: "openai/gpt-5",
				fallbackIndex: 0,
			}),
		);
		mockManager.setDispatchInFlight(true);
		const handler = createChatMessageHandler(mockManager as unknown);

		const output = {
			message: { model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" } },
			parts: [],
		};

		await handler({ sessionID: "sess-1" }, output);

		// Should NOT be overridden
		expect(output.message.model).toEqual({ providerID: "anthropic", modelID: "claude-sonnet-4-5" });
	});

	test("when compaction is in flight, does not modify output", async () => {
		mockManager.states.set(
			"sess-1",
			createFallbackState({
				currentModel: "openai/gpt-5",
				fallbackIndex: 0,
			}),
		);
		mockManager.setCompactionInFlight(true);
		const handler = createChatMessageHandler(mockManager as unknown);

		const output = {
			message: { model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" } },
			parts: [],
		};

		await handler({ sessionID: "sess-1" }, output);

		expect(output.message.model).toEqual({ providerID: "anthropic", modelID: "claude-sonnet-4-5" });
	});

	test("handles model strings with multiple slashes", async () => {
		mockManager.states.set(
			"sess-1",
			createFallbackState({
				currentModel: "openai/gpt-4/turbo",
				fallbackIndex: 0,
				attemptCount: 1,
			}),
		);
		const handler = createChatMessageHandler(mockManager as unknown);

		const output = {
			message: { model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" } },
			parts: [],
		};

		await handler({ sessionID: "sess-1" }, output);

		expect(output.message.model).toEqual({ providerID: "openai", modelID: "gpt-4/turbo" });
	});

	test("calls tryRecoverToOriginal to check for cooldown expiry", async () => {
		mockManager.states.set("sess-1", createFallbackState());
		const handler = createChatMessageHandler(mockManager as unknown);

		await handler({ sessionID: "sess-1" }, { message: { model: undefined }, parts: [] });

		const recoverCall = mockManager.calls.find((c) => c.method === "tryRecoverToOriginal");
		expect(recoverCall).toBeDefined();
	});
});
