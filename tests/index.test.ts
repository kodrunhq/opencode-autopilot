import { describe, expect, test } from "bun:test";
import plugin from "../src/index";

describe("plugin entry point", () => {
	// Mock client with the session/tui stubs the fallback subsystem needs
	const mockClient = {
		session: {
			abort: async () => {},
			messages: async () => ({ data: [] }),
			promptAsync: async () => {},
			get: async () => ({}),
		},
		tui: {
			showToast: async () => {},
		},
		provider: {
			list: async () => ({ data: { all: [] } }),
		},
	};

	const mockInput = {
		client: mockClient as unknown as ReturnType<
			typeof import("@opencode-ai/sdk").createOpencodeClient
		>,
		project: {} as import("@opencode-ai/sdk").Project,
		directory: "/tmp",
		worktree: "/tmp",
		serverUrl: new URL("http://localhost:3000"),
		// biome-ignore lint/suspicious/noExplicitAny: BunShell mock requires any
		$: {} as any,
	};

	test("default export is a function", () => {
		expect(typeof plugin).toBe("function");
	});

	test("returns hooks object with tool property", async () => {
		const result = await plugin(mockInput);
		expect(result.tool).toBeDefined();
	});

	test("tool property contains oc_configure", async () => {
		const result = await plugin(mockInput);
		expect(result.tool?.oc_configure).toBeDefined();
		expect(typeof result.tool?.oc_configure.execute).toBe("function");
	});

	test("returns event handler function", async () => {
		const result = await plugin(mockInput);
		expect(result.event).toBeDefined();
		expect(typeof result.event).toBe("function");
	});

	test("event handler handles session.created gracefully", async () => {
		const result = await plugin(mockInput);
		const eventResult = await result.event?.(
			// biome-ignore lint/suspicious/noExplicitAny: SDK event mock requires any
			{ event: { type: "session.created", properties: {} } } as any,
		);
		expect(eventResult).toBeUndefined();
	});

	test("registers all expected tools (17 total)", async () => {
		const result = await plugin(mockInput);
		expect(result.tool).toBeDefined();
		const toolNames = [...Object.keys(result.tool ?? {})].sort();
		const expected = [
			"oc_configure",
			"oc_create_agent",
			"oc_create_skill",
			"oc_create_command",
			"oc_state",
			"oc_confidence",
			"oc_doctor",
			"oc_phase",
			"oc_plan",
			"oc_orchestrate",
			"oc_quick",
			"oc_forensics",
			"oc_review",
			"oc_logs",
			"oc_session_stats",
			"oc_pipeline_report",
			"oc_mock_fallback",
		];
		expect(toolNames).toEqual([...expected].sort());
		expect(toolNames).toHaveLength(17);
	});

	test("every registered tool has a valid execute function", async () => {
		const result = await plugin(mockInput);
		expect(result.tool).toBeDefined();
		for (const [_name, tool] of Object.entries(result.tool ?? {})) {
			expect(typeof tool.execute).toBe("function");
			expect(tool.description).toBeDefined();
		}
	});

	test("returns chat.message hook", async () => {
		const result = await plugin(mockInput);
		// biome-ignore lint/suspicious/noExplicitAny: accessing dynamic hook key
		const chatMessage = (result as any)["chat.message"];
		expect(chatMessage).toBeDefined();
		expect(typeof chatMessage).toBe("function");
	});

	test("returns tool.execute.after hook", async () => {
		const result = await plugin(mockInput);
		// biome-ignore lint/suspicious/noExplicitAny: accessing dynamic hook key
		const toolExecAfter = (result as any)["tool.execute.after"];
		expect(toolExecAfter).toBeDefined();
		expect(typeof toolExecAfter).toBe("function");
	});

	test("plugin return object has all 6 hook keys", async () => {
		const result = await plugin(mockInput);
		const keys = Object.keys(result);
		expect(keys).toContain("tool");
		expect(keys).toContain("event");
		expect(keys).toContain("config");
		expect(keys).toContain("chat.message");
		expect(keys).toContain("tool.execute.before");
		expect(keys).toContain("tool.execute.after");
	});

	test("returns tool.execute.before hook", async () => {
		const result = await plugin(mockInput);
		// biome-ignore lint/suspicious/noExplicitAny: accessing dynamic hook key
		const toolExecBefore = (result as any)["tool.execute.before"];
		expect(toolExecBefore).toBeDefined();
		expect(typeof toolExecBefore).toBe("function");
	});

	test("oc_logs tool is registered", async () => {
		const result = await plugin(mockInput);
		expect(result.tool?.oc_logs).toBeDefined();
		expect(typeof result.tool?.oc_logs.execute).toBe("function");
	});

	test("oc_session_stats tool is registered", async () => {
		const result = await plugin(mockInput);
		expect(result.tool?.oc_session_stats).toBeDefined();
		expect(typeof result.tool?.oc_session_stats.execute).toBe("function");
	});

	test("oc_pipeline_report tool is registered", async () => {
		const result = await plugin(mockInput);
		expect(result.tool?.oc_pipeline_report).toBeDefined();
		expect(typeof result.tool?.oc_pipeline_report.execute).toBe("function");
	});

	test("oc_mock_fallback tool is registered", async () => {
		const result = await plugin(mockInput);
		expect(result.tool?.oc_mock_fallback).toBeDefined();
		expect(typeof result.tool?.oc_mock_fallback.execute).toBe("function");
	});
});
