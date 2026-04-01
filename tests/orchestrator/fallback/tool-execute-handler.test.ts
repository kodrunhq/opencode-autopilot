import { beforeEach, describe, expect, test } from "bun:test";

// Minimal mock for FallbackManager
function createMockManager() {
	const parentIDs = new Map<string, string | null>();
	return {
		parentIDs,
		getParentID(sessionID: string): string | null | undefined {
			return parentIDs.get(sessionID);
		},
	};
}

describe("createToolExecuteAfterHandler", () => {
	// biome-ignore lint/suspicious/noExplicitAny: dynamic import
	let createToolExecuteAfterHandler: any;
	// biome-ignore lint/suspicious/noExplicitAny: mock type
	let mockManager: any;

	beforeEach(async () => {
		const mod = await import("../../../src/orchestrator/fallback/tool-execute-handler");
		createToolExecuteAfterHandler = mod.createToolExecuteAfterHandler;
		mockManager = createMockManager();
	});

	test("non-task tool returns without touching output", async () => {
		const handler = createToolExecuteAfterHandler(mockManager);
		const output = { title: "read", output: "file content", metadata: {} };
		await handler(
			{ tool: "read", sessionID: "sess-1", callID: "c1", args: {} },
			output,
		);
		expect(output.metadata).toEqual({});
	});

	test("task tool with non-empty output returns without touching output", async () => {
		const handler = createToolExecuteAfterHandler(mockManager);
		const output = { title: "task", output: "result data", metadata: {} };
		await handler(
			{ tool: "task", sessionID: "sess-1", callID: "c1", args: {} },
			output,
		);
		expect(output.metadata).toEqual({});
	});

	test("task tool with empty output and parentID sets fallbackPending", async () => {
		mockManager.parentIDs.set("sess-1", "parent-1");
		const handler = createToolExecuteAfterHandler(mockManager);
		const output = { title: "task", output: "", metadata: {} as unknown };
		await handler(
			{ tool: "task", sessionID: "sess-1", callID: "c1", args: {} },
			output,
		);
		expect((output.metadata as Record<string, unknown>).fallbackPending).toBe(true);
	});

	test("task tool with empty output and no parentID does NOT set flag", async () => {
		const handler = createToolExecuteAfterHandler(mockManager);
		const output = { title: "task", output: "", metadata: {} };
		await handler(
			{ tool: "task", sessionID: "sess-1", callID: "c1", args: {} },
			output,
		);
		expect(output.metadata).toEqual({});
	});

	test("task_result sentinel string is treated as empty", async () => {
		mockManager.parentIDs.set("sess-1", "parent-1");
		const handler = createToolExecuteAfterHandler(mockManager);
		const output = {
			title: "task",
			output: "<task_result></task_result>",
			metadata: {} as unknown,
		};
		await handler(
			{ tool: "task", sessionID: "sess-1", callID: "c1", args: {} },
			output,
		);
		expect((output.metadata as Record<string, unknown>).fallbackPending).toBe(true);
	});

	test("empty output with existing metadata merges correctly", async () => {
		mockManager.parentIDs.set("sess-1", "parent-1");
		const handler = createToolExecuteAfterHandler(mockManager);
		const output = {
			title: "task",
			output: "",
			metadata: { existing: "value" } as unknown,
		};
		await handler(
			{ tool: "task", sessionID: "sess-1", callID: "c1", args: {} },
			output,
		);
		const meta = output.metadata as Record<string, unknown>;
		expect(meta.fallbackPending).toBe(true);
		expect(meta.existing).toBe("value");
	});

	test("whitespace-only output is treated as empty", async () => {
		mockManager.parentIDs.set("sess-1", "parent-1");
		const handler = createToolExecuteAfterHandler(mockManager);
		const output = { title: "task", output: "   \n\t  ", metadata: {} as unknown };
		await handler(
			{ tool: "task", sessionID: "sess-1", callID: "c1", args: {} },
			output,
		);
		expect((output.metadata as Record<string, unknown>).fallbackPending).toBe(true);
	});
});
