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

	test("tool property contains oc_placeholder", async () => {
		const result = await plugin(mockInput);
		expect(result.tool?.oc_placeholder).toBeDefined();
		expect(typeof result.tool?.oc_placeholder.execute).toBe("function");
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

	test("registers all expected tools", async () => {
		const result = await plugin(mockInput);
		expect(result.tool).toBeDefined();
		const toolNames = [...Object.keys(result.tool ?? {})].sort();
		const expected = [
			"oc_placeholder",
			"oc_create_agent",
			"oc_create_skill",
			"oc_create_command",
			"oc_state",
			"oc_confidence",
			"oc_phase",
			"oc_plan",
			"oc_orchestrate",
			"oc_forensics",
			"oc_review",
		];
		expect(toolNames).toEqual([...expected].sort());
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

	test("plugin return object has all 5 hook keys", async () => {
		const result = await plugin(mockInput);
		const keys = Object.keys(result);
		expect(keys).toContain("tool");
		expect(keys).toContain("event");
		expect(keys).toContain("config");
		expect(keys).toContain("chat.message");
		expect(keys).toContain("tool.execute.after");
	});
});
