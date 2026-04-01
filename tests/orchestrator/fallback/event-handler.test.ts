import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { FallbackConfig } from "../../../src/orchestrator/fallback/fallback-config";
import type { FallbackPlan, FallbackState } from "../../../src/orchestrator/fallback/types";

// Minimal mock for FallbackManager
function createMockManager() {
	const calls: Array<{ method: string; args: unknown[] }> = [];

	const states = new Map<string, FallbackState>();

	return {
		calls,
		states,
		initSession(sessionID: string, model: string, parentID?: string | null) {
			calls.push({ method: "initSession", args: [sessionID, model, parentID] });
		},
		getSessionState(sessionID: string) {
			calls.push({ method: "getSessionState", args: [sessionID] });
			return states.get(sessionID);
		},
		cleanupSession(sessionID: string) {
			calls.push({ method: "cleanupSession", args: [sessionID] });
		},
		isSelfAbortError(sessionID: string) {
			calls.push({ method: "isSelfAbortError", args: [sessionID] });
			return false;
		},
		isStaleError(sessionID: string, errorModel?: string) {
			calls.push({ method: "isStaleError", args: [sessionID, errorModel] });
			return false;
		},
		handleError(sessionID: string, error: unknown, errorModel?: string): FallbackPlan | null {
			calls.push({ method: "handleError", args: [sessionID, error, errorModel] });
			return null;
		},
		recordSelfAbort(sessionID: string) {
			calls.push({ method: "recordSelfAbort", args: [sessionID] });
		},
		commitAndUpdateState(sessionID: string, plan: FallbackPlan) {
			calls.push({ method: "commitAndUpdateState", args: [sessionID, plan] });
			return true;
		},
		releaseRetryLock(sessionID: string) {
			calls.push({ method: "releaseRetryLock", args: [sessionID] });
		},
		recordFirstToken(sessionID: string) {
			calls.push({ method: "recordFirstToken", args: [sessionID] });
		},
		startTtftTimeout(sessionID: string, onTimeout: () => void) {
			calls.push({ method: "startTtftTimeout", args: [sessionID, onTimeout] });
		},
		clearCompactionInFlight(sessionID: string) {
			calls.push({ method: "clearCompactionInFlight", args: [sessionID] });
		},
		isDispatchInFlight(sessionID: string) {
			calls.push({ method: "isDispatchInFlight", args: [sessionID] });
			return false;
		},
		tryRecoverToOriginal(sessionID: string) {
			calls.push({ method: "tryRecoverToOriginal", args: [sessionID] });
			return false;
		},
		isCompactionInFlight(sessionID: string) {
			calls.push({ method: "isCompactionInFlight", args: [sessionID] });
			return false;
		},
		getParentID(sessionID: string) {
			calls.push({ method: "getParentID", args: [sessionID] });
			return undefined;
		},
		markAwaitingResult(sessionID: string) {
			calls.push({ method: "markAwaitingResult", args: [sessionID] });
		},
		clearAwaitingResult(sessionID: string) {
			calls.push({ method: "clearAwaitingResult", args: [sessionID] });
		},
	};
}

// Minimal mock for SdkOperations
function createMockSdk() {
	const calls: Array<{ method: string; args: unknown[] }> = [];
	return {
		calls,
		abortSession: async (sessionID: string) => {
			calls.push({ method: "abortSession", args: [sessionID] });
		},
		getSessionMessages: async (_sessionID: string) => {
			calls.push({ method: "getSessionMessages", args: [_sessionID] });
			return [{ type: "text", text: "test message" }] as const;
		},
		promptAsync: async (
			sessionID: string,
			model: { providerID: string; modelID: string },
			parts: readonly import("../../../src/orchestrator/fallback/types").MessagePart[],
		) => {
			calls.push({ method: "promptAsync", args: [sessionID, model, parts] });
		},
		showToast: async (title: string, message: string, variant: "info" | "warning" | "error") => {
			calls.push({ method: "showToast", args: [title, message, variant] });
		},
	};
}

const defaultConfig: FallbackConfig = {
	enabled: true,
	retryOnErrors: [429, 500, 502, 503],
	retryableErrorPatterns: [],
	maxFallbackAttempts: 10,
	cooldownSeconds: 60,
	timeoutSeconds: 30,
	notifyOnFallback: true,
};

describe("createEventHandler", () => {
	let mockManager: ReturnType<typeof createMockManager>;
	let mockSdk: ReturnType<typeof createMockSdk>;
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import mock
	let createEventHandler: any;

	beforeEach(async () => {
		mockManager = createMockManager();
		mockSdk = createMockSdk();
		const mod = await import("../../../src/orchestrator/fallback/event-handler");
		createEventHandler = mod.createEventHandler;
	});

	test("session.created calls manager.initSession with session model", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.created",
				properties: {
					info: { id: "sess-1", model: "anthropic/claude-sonnet-4-5", parentID: null },
				},
			},
		});

		const initCall = mockManager.calls.find((c) => c.method === "initSession");
		expect(initCall).toBeDefined();
		expect(initCall?.args[0]).toBe("sess-1");
		expect(initCall?.args[1]).toBe("anthropic/claude-sonnet-4-5");
	});

	test("session.created with parentID records parent-child mapping", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.created",
				properties: {
					info: { id: "child-1", model: "openai/gpt-5", parentID: "parent-1" },
				},
			},
		});

		const initCall = mockManager.calls.find((c) => c.method === "initSession");
		expect(initCall).toBeDefined();
		expect(initCall?.args[2]).toBe("parent-1");
	});

	test("session.deleted calls manager.cleanupSession", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.deleted",
				properties: { info: { id: "sess-1" } },
			},
		});

		const cleanupCall = mockManager.calls.find((c) => c.method === "cleanupSession");
		expect(cleanupCall).toBeDefined();
		expect(cleanupCall?.args[0]).toBe("sess-1");
	});

	test("session.error with retryable error calls handleError", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.error",
				properties: {
					sessionID: "sess-1",
					error: { message: "rate limit exceeded", status: 429 },
					model: "anthropic/claude-sonnet-4-5",
				},
			},
		});

		const handleCall = mockManager.calls.find((c) => c.method === "handleError");
		expect(handleCall).toBeDefined();
		expect(handleCall?.args[0]).toBe("sess-1");
	});

	test("session.error that is a self-abort is suppressed", async () => {
		mockManager.isSelfAbortError = (sessionID: string) => {
			mockManager.calls.push({ method: "isSelfAbortError", args: [sessionID] });
			return true;
		};
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.error",
				properties: {
					sessionID: "sess-1",
					error: { message: "aborted" },
				},
			},
		});

		const handleCall = mockManager.calls.find((c) => c.method === "handleError");
		expect(handleCall).toBeUndefined();
	});

	test("session.compacted calls manager.clearCompactionInFlight", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.compacted",
				properties: { sessionID: "sess-1" },
			},
		});

		const clearCall = mockManager.calls.find((c) => c.method === "clearCompactionInFlight");
		expect(clearCall).toBeDefined();
		expect(clearCall?.args[0]).toBe("sess-1");
	});

	test("message.part.delta calls manager.recordFirstToken", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "message.part.delta",
				properties: { info: { sessionID: "sess-1" } },
			},
		});

		const tokenCall = mockManager.calls.find((c) => c.method === "recordFirstToken");
		expect(tokenCall).toBeDefined();
		expect(tokenCall?.args[0]).toBe("sess-1");
	});

	test("message.updated with error calls handleError", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "message.updated",
				properties: {
					info: {
						sessionID: "sess-1",
						error: { message: "service unavailable" },
						model: "openai/gpt-5",
					},
				},
			},
		});

		const handleCall = mockManager.calls.find((c) => c.method === "handleError");
		expect(handleCall).toBeDefined();
	});

	test("session.error with plan triggers fallback dispatch", async () => {
		const plan: FallbackPlan = {
			failedModel: "anthropic/claude-sonnet-4-5",
			newModel: "openai/gpt-5",
			newFallbackIndex: 0,
			reason: "rate_limit",
		};

		mockManager.handleError = (sessionID: string, error: unknown, errorModel?: string) => {
			mockManager.calls.push({ method: "handleError", args: [sessionID, error, errorModel] });
			return plan;
		};

		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.error",
				properties: {
					sessionID: "sess-1",
					error: { message: "rate limit", status: 429 },
					model: "anthropic/claude-sonnet-4-5",
				},
			},
		});

		// Should abort session
		const abortCall = mockSdk.calls.find((c) => c.method === "abortSession");
		expect(abortCall).toBeDefined();

		// Should commit state
		const commitCall = mockManager.calls.find((c) => c.method === "commitAndUpdateState");
		expect(commitCall).toBeDefined();

		// Should release retry lock
		const releaseCall = mockManager.calls.find((c) => c.method === "releaseRetryLock");
		expect(releaseCall).toBeDefined();
	});

	test("session.created with model and timeout > 0 starts TTFT timeout", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.created",
				properties: {
					info: { id: "sess-1", model: "anthropic/claude-sonnet-4-5" },
				},
			},
		});

		const ttftCall = mockManager.calls.find((c) => c.method === "startTtftTimeout");
		expect(ttftCall).toBeDefined();
		expect(ttftCall?.args[0]).toBe("sess-1");
	});

	test("session.diff calls manager.recordFirstToken", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.diff",
				properties: { sessionID: "sess-1" },
			},
		});

		const tokenCall = mockManager.calls.find((c) => c.method === "recordFirstToken");
		expect(tokenCall).toBeDefined();
	});

	test("session.error non-retryable does not trigger fallback dispatch", async () => {
		// handleError returns null for non-retryable
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.error",
				properties: {
					sessionID: "sess-1",
					error: { message: "some non-retryable error" },
				},
			},
		});

		const abortCall = mockSdk.calls.find((c) => c.method === "abortSession");
		expect(abortCall).toBeUndefined();
	});

	test("session.created without model does not start TTFT timeout", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: defaultConfig });

		await handler({
			event: {
				type: "session.created",
				properties: {
					info: { id: "sess-1" },
				},
			},
		});

		const ttftCall = mockManager.calls.find((c) => c.method === "startTtftTimeout");
		expect(ttftCall).toBeUndefined();
	});

	test("notify on fallback sends toast when enabled", async () => {
		const plan: FallbackPlan = {
			failedModel: "anthropic/claude-sonnet-4-5",
			newModel: "openai/gpt-5",
			newFallbackIndex: 0,
			reason: "rate_limit",
		};

		mockManager.handleError = (sessionID: string, error: unknown, errorModel?: string) => {
			mockManager.calls.push({ method: "handleError", args: [sessionID, error, errorModel] });
			return plan;
		};

		// biome-ignore lint/suspicious/noExplicitAny: mock manager type
		const handler = createEventHandler({ manager: mockManager as any, sdk: mockSdk, config: { ...defaultConfig, notifyOnFallback: true } });

		await handler({
			event: {
				type: "session.error",
				properties: {
					sessionID: "sess-1",
					error: { message: "rate limit", status: 429 },
					model: "anthropic/claude-sonnet-4-5",
				},
			},
		});

		const toastCall = mockSdk.calls.find((c) => c.method === "showToast");
		expect(toastCall).toBeDefined();
	});
});

describe("parseModelString", () => {
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import
	let parseModelString: any;

	beforeEach(async () => {
		const mod = await import("../../../src/orchestrator/fallback/event-handler");
		parseModelString = mod.parseModelString;
	});

	test("parses simple provider/model string", () => {
		const result = parseModelString("anthropic/claude-sonnet-4-5");
		expect(result).toEqual({ providerID: "anthropic", modelID: "claude-sonnet-4-5" });
	});

	test("parses model string with multiple slashes", () => {
		const result = parseModelString("openai/gpt-4/turbo");
		expect(result).toEqual({ providerID: "openai", modelID: "gpt-4/turbo" });
	});

	test("returns null for string without slash", () => {
		const result = parseModelString("claude-sonnet");
		expect(result).toBeNull();
	});

	test("returns null for empty string", () => {
		const result = parseModelString("");
		expect(result).toBeNull();
	});
});
