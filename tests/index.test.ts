import { describe, expect, test } from "bun:test";
import type { LoopContext } from "../src/autonomy/types";
import { VerificationHandler } from "../src/autonomy/verification";
import { createDefaultConfig } from "../src/config";
import plugin, { buildVerificationHandlerDeps } from "../src/index";

describe("plugin entry point", () => {
	type PluginInput = Parameters<typeof plugin>[0];
	type PluginResult = Awaited<ReturnType<typeof plugin>>;

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
		$: {} as PluginInput["$"],
	} satisfies PluginInput;

	function createContext(): LoopContext {
		return {
			taskDescription: "verify project scope",
			maxIterations: 1,
			currentIteration: 1,
			state: "verifying",
			startedAt: new Date().toISOString(),
			lastIterationAt: null,
			accumulatedContext: [],
			verificationResults: [],
			oracleVerification: null,
		};
	}

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
		const eventInput = {
			event: { type: "session.created", properties: { info: {} } },
		} as unknown as Parameters<NonNullable<PluginResult["event"]>>[0];
		const eventResult = await result.event?.(eventInput);
		expect(eventResult).toBeUndefined();
	});

	test("registers all expected tools (35 total)", async () => {
		const result = await plugin(mockInput);
		expect(result.tool).toBeDefined();
		const toolNames = [...Object.keys(result.tool ?? {})].sort();
		const expected = [
			"oc_background",
			"oc_configure",
			"oc_lsp_goto_definition",
			"oc_lsp_find_references",
			"oc_lsp_symbols",
			"oc_lsp_diagnostics",
			"oc_lsp_prepare_rename",
			"oc_lsp_rename",
			"oc_delegate",
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
			"oc_recover",
			"oc_forensics",
			"oc_graph_index",
			"oc_graph_query",
			"oc_review",
			"oc_route",
			"oc_logs",
			"oc_loop",
			"oc_session_stats",
			"oc_pipeline_report",
			"oc_mock_fallback",
			"oc_stocktake",
			"oc_update_docs",
			"oc_memory_forget",
			"oc_memory_save",
			"oc_memory_search",
			"oc_memory_status",
			"oc_memory_preferences",
			"oc_hashline_edit",
			"oc_summary",
		];
		expect(toolNames).toEqual([...expected].sort());
		expect(toolNames).toHaveLength(39);
	});

	test("every registered tool has a valid execute function", async () => {
		const result = await plugin(mockInput);
		expect(result.tool).toBeDefined();
		for (const tool of Object.values(result.tool ?? {})) {
			expect(typeof tool.execute).toBe("function");
			expect(tool.description).toBeDefined();
		}
	});

	test("returns chat.message hook", async () => {
		const result = await plugin(mockInput);
		const chatMessage = (result as unknown as Record<string, unknown>)["chat.message"];
		expect(chatMessage).toBeDefined();
		expect(typeof chatMessage).toBe("function");
	});

	test("returns tool.execute.after hook", async () => {
		const result = await plugin(mockInput);
		const toolExecAfter = (result as unknown as Record<string, unknown>)["tool.execute.after"];
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
		expect(keys).toContain("experimental.chat.system.transform");
	});

	test("returns experimental.chat.system.transform hook", async () => {
		const result = await plugin(mockInput);
		const transformHook = (result as unknown as Record<string, unknown>)[
			"experimental.chat.system.transform"
		];
		expect(transformHook).toBeDefined();
		expect(typeof transformHook).toBe("function");
	});

	test("wires verification command overrides from runtime config", () => {
		const config = {
			...createDefaultConfig(),
			verification: {
				commandChecks: [{ name: "tests", command: "bun run test" }],
				projectOverrides: {},
			},
		};

		const deps = buildVerificationHandlerDeps("/tmp/project", config);

		expect(deps.projectRoot).toBe("/tmp/project");
		expect(deps.config).toBe(config);
	});

	test("runtime verification handler uses the project-specific override", async () => {
		const projectRoot = "/tmp/project-a";
		const config = {
			...createDefaultConfig(),
			verification: {
				commandChecks: [{ name: "tests", command: "global-check" }],
				projectOverrides: {
					[projectRoot]: { commandChecks: [{ name: "tests", command: "project-check" }] },
				},
			},
		};
		const commands: string[] = [];
		const handler = new VerificationHandler({
			...buildVerificationHandlerDeps(projectRoot, config),
			runCommand: async (command) => {
				commands.push(command);
				return { exitCode: 0, output: "ok" };
			},
		});

		const result = await handler.verify(createContext());

		expect(commands).toEqual(["project-check"]);
		expect(result.passed).toBe(true);
	});

	test("returns tool.execute.before hook", async () => {
		const result = await plugin(mockInput);
		const toolExecBefore = (result as unknown as Record<string, unknown>)["tool.execute.before"];
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
