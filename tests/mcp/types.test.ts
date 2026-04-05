import { describe, expect, test } from "bun:test";
import { mcpScopeSchema, mcpTransportSchema, skillMcpConfigSchema } from "../../src/mcp/types";

describe("mcpTransportSchema", () => {
	test("accepts stdio", () => {
		expect(mcpTransportSchema.parse("stdio")).toBe("stdio");
	});

	test("accepts sse", () => {
		expect(mcpTransportSchema.parse("sse")).toBe("sse");
	});

	test("accepts http", () => {
		expect(mcpTransportSchema.parse("http")).toBe("http");
	});

	test("rejects unknown transport", () => {
		expect(() => mcpTransportSchema.parse("ws")).toThrow();
	});
});

describe("mcpScopeSchema", () => {
	test("accepts read", () => {
		expect(mcpScopeSchema.parse("read")).toBe("read");
	});

	test("accepts write", () => {
		expect(mcpScopeSchema.parse("write")).toBe("write");
	});

	test("accepts execute", () => {
		expect(mcpScopeSchema.parse("execute")).toBe("execute");
	});

	test("rejects invalid scope", () => {
		expect(() => mcpScopeSchema.parse("admin")).toThrow();
	});
});

describe("skillMcpConfigSchema", () => {
	test("parses minimal stdio config with defaults", () => {
		const result = skillMcpConfigSchema.parse({
			serverName: "filesystem",
			command: "npx",
		});

		expect(result.serverName).toBe("filesystem");
		expect(result.transport).toBe("stdio");
		expect(result.args).toEqual([]);
		expect(result.env).toEqual({});
		expect(result.scope).toEqual(["read"]);
		expect(result.healthCheckTimeoutMs).toBe(5000);
	});

	test("parses sse config", () => {
		const result = skillMcpConfigSchema.parse({
			serverName: "docs",
			transport: "sse",
			url: "https://example.com/sse",
			scope: ["read", "execute"],
		});

		expect(result.transport).toBe("sse");
		expect(result.url).toBe("https://example.com/sse");
		expect(result.scope).toEqual(["read", "execute"]);
	});

	test("parses http config", () => {
		const result = skillMcpConfigSchema.parse({
			serverName: "api",
			transport: "http",
			url: "https://example.com/http",
			env: { TOKEN: "secret" },
		});

		expect(result.transport).toBe("http");
		expect(result.env).toEqual({ TOKEN: "secret" });
	});

	test("rejects empty serverName", () => {
		expect(() =>
			skillMcpConfigSchema.parse({
				serverName: "",
				command: "npx",
			}),
		).toThrow();
	});

	test("rejects invalid url format", () => {
		expect(() =>
			skillMcpConfigSchema.parse({
				serverName: "broken",
				transport: "http",
				url: "not-a-url",
			}),
		).toThrow();
	});

	test("rejects non-positive health check timeout", () => {
		expect(() =>
			skillMcpConfigSchema.parse({
				serverName: "broken",
				command: "npx",
				healthCheckTimeoutMs: 0,
			}),
		).toThrow();
	});
});
