import { z } from "zod";

export const mcpTransportSchema = z.enum(["stdio", "sse", "http"]);
export type McpTransport = z.infer<typeof mcpTransportSchema>;

export const mcpScopeSchema = z.enum(["read", "write", "execute"]);
export type McpScope = z.infer<typeof mcpScopeSchema>;

export const skillMcpConfigSchema = z.object({
	serverName: z.string().min(1),
	transport: mcpTransportSchema.default("stdio"),
	command: z.string().min(1).optional(),
	args: z.array(z.string()).default([]),
	url: z.string().url().optional(),
	env: z.record(z.string(), z.string()).default({}),
	scope: z.array(mcpScopeSchema).default(["read"]),
	healthCheckTimeoutMs: z.number().int().positive().default(5000),
});
export type SkillMcpConfig = z.infer<typeof skillMcpConfigSchema>;

export type McpServerState = "stopped" | "starting" | "healthy" | "unhealthy" | "stopping";

export interface ManagedMcpServer {
	readonly config: SkillMcpConfig;
	readonly skillName: string;
	readonly state: McpServerState;
	readonly startedAt: string | null;
	readonly lastHealthCheck: string | null;
	readonly connectionCount: number;
}

export interface McpHealthResult {
	readonly serverName: string;
	readonly skillName: string;
	readonly state: McpServerState;
	readonly latencyMs: number | null;
	readonly error: string | null;
}
