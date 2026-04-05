import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { McpLifecycleManager } from "../../src/mcp/manager";
import type { SkillMcpConfig } from "../../src/mcp/types";

function createConfig(overrides?: Partial<SkillMcpConfig>): SkillMcpConfig {
	return {
		serverName: overrides?.serverName ?? "filesystem",
		transport: overrides?.transport ?? "stdio",
		command: overrides?.command ?? "npx",
		args: overrides?.args ?? ["-y", "@modelcontextprotocol/server-filesystem"],
		url: overrides?.url,
		env: overrides?.env ?? {},
		scope: overrides?.scope ?? ["read"],
		healthCheckTimeoutMs: overrides?.healthCheckTimeoutMs ?? 250,
	};
}

describe("McpLifecycleManager", () => {
	let manager: McpLifecycleManager;

	beforeEach(() => {
		manager = new McpLifecycleManager();
	});

	afterEach(async () => {
		await manager.stopAll();
	});

	test("starts a valid stdio server as healthy", async () => {
		const server = await manager.startServer("docs", createConfig());
		expect(server.skillName).toBe("docs");
		expect(server.state).toBe("healthy");
		expect(server.connectionCount).toBe(1);
		expect(server.startedAt).not.toBeNull();
	});

	test("reuses an existing server and increments connection count", async () => {
		await manager.startServer("docs", createConfig());
		const server = await manager.startServer("reviewer", createConfig());
		expect(server.connectionCount).toBe(2);
		expect(manager.listServers()).toHaveLength(1);
	});

	test("returns a snapshot from getServer", async () => {
		await manager.startServer("docs", createConfig());
		const server = manager.getServer("filesystem");
		expect(server?.config.serverName).toBe("filesystem");
		expect(server?.state).toBe("healthy");
	});

	test("lists servers in alphabetical order", async () => {
		await manager.startServer("docs", createConfig({ serverName: "zeta" }));
		await manager.startServer("ops", createConfig({ serverName: "alpha" }));
		expect(manager.listServers().map((server) => server.config.serverName)).toEqual([
			"alpha",
			"zeta",
		]);
	});

	test("marks stdio server unhealthy when command is missing", async () => {
		const server = await manager.startServer("docs", {
			serverName: "filesystem",
			transport: "stdio",
			args: [],
			env: {},
			scope: ["read"],
			healthCheckTimeoutMs: 250,
		} as SkillMcpConfig);
		expect(server.state).toBe("unhealthy");
	});

	test("marks http server unhealthy when url is missing", async () => {
		const server = await manager.startServer("docs", {
			serverName: "filesystem",
			transport: "http",
			env: {},
			scope: ["read"],
			healthCheckTimeoutMs: 250,
		} as SkillMcpConfig);
		expect(server.state).toBe("unhealthy");
	});

	test("healthCheck returns server not found for unknown server", async () => {
		const result = await manager.healthCheck("missing");
		expect(result.state).toBe("stopped");
		expect(result.error).toContain("not found");
	});

	test("healthCheckAll returns all server results", async () => {
		await manager.startServer("docs", createConfig({ serverName: "filesystem" }));
		await manager.startServer(
			"ops",
			createConfig({
				serverName: "shell",
				scope: ["execute"],
			}),
		);
		const result = await manager.healthCheckAll();
		expect(result).toHaveLength(2);
		expect(result.every((entry) => entry.state === "healthy")).toBe(true);
	});

	test("stopServer decrements pooled connection count before removing server", async () => {
		await manager.startServer("docs", createConfig());
		await manager.startServer("reviewer", createConfig());
		await manager.stopServer("filesystem");
		expect(manager.getServer("filesystem")?.connectionCount).toBe(1);
		await manager.stopServer("filesystem");
		expect(manager.getServer("filesystem")).toBeUndefined();
	});

	test("stopAll removes every tracked server", async () => {
		await manager.startServer("docs", createConfig({ serverName: "filesystem" }));
		await manager.startServer(
			"ops",
			createConfig({
				serverName: "shell",
				scope: ["execute"],
			}),
		);
		await manager.stopAll();
		expect(manager.listServers()).toEqual([]);
	});

	test("throws on conflicting config for the same server name", async () => {
		await manager.startServer("docs", createConfig());
		await expect(manager.startServer("ops", createConfig({ args: ["different"] }))).rejects.toThrow(
			"Conflicting MCP configuration",
		);
	});
});
