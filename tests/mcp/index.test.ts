import { describe, expect, test } from "bun:test";
import * as mcp from "../../src/mcp";
import { McpLifecycleManager } from "../../src/mcp/manager";
import { filterByScope, isActionAllowed } from "../../src/mcp/scope-filter";
import { mcpScopeSchema, mcpTransportSchema, skillMcpConfigSchema } from "../../src/mcp/types";

describe("src/mcp barrel exports", () => {
	test("exports McpLifecycleManager", () => {
		expect(mcp.McpLifecycleManager).toBe(McpLifecycleManager);
	});

	test("exports filterByScope", () => {
		expect(mcp.filterByScope).toBe(filterByScope);
	});

	test("exports isActionAllowed", () => {
		expect(mcp.isActionAllowed).toBe(isActionAllowed);
	});

	test("exports mcpTransportSchema", () => {
		expect(mcp.mcpTransportSchema).toBe(mcpTransportSchema);
	});

	test("exports mcpScopeSchema", () => {
		expect(mcp.mcpScopeSchema).toBe(mcpScopeSchema);
	});

	test("exports skillMcpConfigSchema", () => {
		expect(mcp.skillMcpConfigSchema).toBe(skillMcpConfigSchema);
	});

	test("barrel manager can start a server", async () => {
		const manager = new mcp.McpLifecycleManager();
		const server = await manager.startServer("docs", {
			serverName: "filesystem",
			command: "npx",
			args: [],
			env: {},
			scope: ["read"],
			healthCheckTimeoutMs: 100,
			transport: "stdio",
		});
		expect(server.state).toBe("healthy");
		await manager.stopAll();
	});

	test("barrel scope helpers can deny disallowed actions", () => {
		const result = mcp.filterByScope("write_file", "write", "filesystem", "docs", ["read"]);
		expect(result.allowed).toBe(false);
		expect(result.violation?.toolName).toBe("write_file");
	});
});
