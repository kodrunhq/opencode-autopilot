import type { ManagedMcpServer, McpHealthResult, McpServerState, SkillMcpConfig } from "./types";
import { skillMcpConfigSchema } from "./types";

const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 5000;

const VALID_STATE_TRANSITIONS = Object.freeze({
	stopped: Object.freeze(["starting"] as const),
	starting: Object.freeze(["healthy", "unhealthy", "stopping"] as const),
	healthy: Object.freeze(["healthy", "unhealthy", "stopping"] as const),
	unhealthy: Object.freeze(["starting", "healthy", "unhealthy", "stopping"] as const),
	stopping: Object.freeze(["stopped"] as const),
}) satisfies Readonly<Record<McpServerState, readonly McpServerState[]>>;

interface InternalManagedMcpServer {
	config: SkillMcpConfig;
	skillName: string;
	state: McpServerState;
	startedAt: string | null;
	lastHealthCheck: string | null;
	connectionCount: number;
	referencingSkills: Set<string>;
}

function cloneServerSnapshot(server: InternalManagedMcpServer): ManagedMcpServer {
	return Object.freeze({
		config: {
			...server.config,
			args: [...server.config.args],
			env: { ...server.config.env },
			scope: [...server.config.scope],
		},
		skillName: server.skillName,
		state: server.state,
		startedAt: server.startedAt,
		lastHealthCheck: server.lastHealthCheck,
		connectionCount: server.connectionCount,
	});
}

function cloneHealthResult(result: McpHealthResult): McpHealthResult {
	return Object.freeze({ ...result });
}

function getValidationErrorMessage(config: SkillMcpConfig): string | null {
	if (config.transport === "stdio" && !config.command) {
		return "stdio transport requires a command";
	}

	if ((config.transport === "sse" || config.transport === "http") && !config.url) {
		return `${config.transport} transport requires a url`;
	}

	return null;
}

function createInternalServer(skillName: string, config: SkillMcpConfig): InternalManagedMcpServer {
	return {
		config,
		skillName,
		state: "stopped",
		startedAt: null,
		lastHealthCheck: null,
		connectionCount: 0,
		referencingSkills: new Set<string>(),
	};
}

/**
 * MCP lifecycle manager.
 *
 * CURRENT STATUS: This is a CONFIG-ONLY inventory manager.
 * It validates MCP server configurations and tracks state,
 * but does NOT spawn processes, open transports, or perform
 * MCP protocol negotiation. Real process lifecycle will be
 * added when OpenCode's host-managed MCP capabilities are
 * integrated.
 *
 * Do NOT treat healthCheck() as proof of a running server.
 */
export class McpLifecycleManager {
	private readonly healthCheckTimeoutMs: number;

	private readonly servers = new Map<string, InternalManagedMcpServer>();

	public constructor(options?: { healthCheckTimeoutMs?: number }) {
		this.healthCheckTimeoutMs = options?.healthCheckTimeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
	}

	public async startServer(skillName: string, config: SkillMcpConfig): Promise<ManagedMcpServer> {
		const parsedConfig = skillMcpConfigSchema.parse({
			...config,
			healthCheckTimeoutMs: config.healthCheckTimeoutMs ?? this.healthCheckTimeoutMs,
		});
		const existingServer = this.servers.get(parsedConfig.serverName);

		if (existingServer) {
			this.ensureCompatibleConfig(existingServer.config, parsedConfig);
			existingServer.referencingSkills.add(skillName);
			existingServer.connectionCount = existingServer.referencingSkills.size;

			if (existingServer.state === "unhealthy") {
				this.transitionState(existingServer, "starting");
				await this.healthCheck(parsedConfig.serverName);
			}

			return cloneServerSnapshot(existingServer);
		}

		const server = createInternalServer(skillName, parsedConfig);
		server.referencingSkills.add(skillName);
		server.connectionCount = 1;
		server.startedAt = new Date().toISOString();
		this.transitionState(server, "starting");
		this.servers.set(parsedConfig.serverName, server);

		await this.healthCheck(parsedConfig.serverName);
		return cloneServerSnapshot(server);
	}

	public async stopServer(serverName: string): Promise<void> {
		const server = this.servers.get(serverName);
		if (!server) return;

		if (server.connectionCount > 1) {
			const [firstSkillName] = server.referencingSkills;
			if (firstSkillName) {
				server.referencingSkills.delete(firstSkillName);
			}
			server.connectionCount = server.referencingSkills.size;
			return;
		}

		this.transitionState(server, "stopping");
		server.connectionCount = 0;
		server.referencingSkills.clear();
		server.startedAt = null;
		this.transitionState(server, "stopped");
		this.servers.delete(serverName);
	}

	public async stopAll(): Promise<void> {
		await Promise.all([...this.servers.keys()].map((serverName) => this.stopServer(serverName)));
	}

	public getServer(serverName: string): ManagedMcpServer | undefined {
		const server = this.servers.get(serverName);
		return server ? cloneServerSnapshot(server) : undefined;
	}

	public listServers(): readonly ManagedMcpServer[] {
		return Object.freeze(
			[...this.servers.values()]
				.sort((left, right) => left.config.serverName.localeCompare(right.config.serverName))
				.map((server) => cloneServerSnapshot(server)),
		);
	}

	public async healthCheck(serverName: string): Promise<McpHealthResult> {
		const server = this.servers.get(serverName);
		if (!server) {
			return cloneHealthResult({
				serverName,
				skillName: "",
				state: "stopped",
				latencyMs: null,
				error: "Server not found",
			});
		}

		const startedAt = Date.now();
		const validationMessage = getValidationErrorMessage(server.config);
		const latencyMs = Math.min(Date.now() - startedAt, server.config.healthCheckTimeoutMs);
		server.lastHealthCheck = new Date().toISOString();

		if (validationMessage !== null) {
			this.transitionState(server, "unhealthy");
			return cloneHealthResult({
				serverName: server.config.serverName,
				skillName: server.skillName,
				state: server.state,
				latencyMs,
				error: validationMessage,
			});
		}

		this.transitionState(server, "healthy");
		return cloneHealthResult({
			serverName: server.config.serverName,
			skillName: server.skillName,
			state: server.state,
			latencyMs,
			error: null,
		});
	}

	public async healthCheckAll(): Promise<readonly McpHealthResult[]> {
		const healthResults = await Promise.all(
			[...this.servers.keys()].map((serverName) => this.healthCheck(serverName)),
		);
		return Object.freeze(healthResults);
	}

	private ensureCompatibleConfig(current: SkillMcpConfig, next: SkillMcpConfig): void {
		const currentConfig = JSON.stringify(current);
		const nextConfig = JSON.stringify(next);
		if (currentConfig !== nextConfig) {
			throw new Error(`Conflicting MCP configuration for server '${current.serverName}'`);
		}
	}

	private transitionState(server: InternalManagedMcpServer, nextState: McpServerState): void {
		const allowedTransitions = VALID_STATE_TRANSITIONS[server.state] as readonly McpServerState[];
		if (!allowedTransitions.includes(nextState)) {
			throw new Error(`Invalid MCP state transition: ${server.state} -> ${nextState}`);
		}
		server.state = nextState;
	}
}
