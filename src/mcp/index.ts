export { McpLifecycleManager } from "./manager";
export type { McpToolAction, ScopeViolation } from "./scope-filter";
export { filterByScope, isActionAllowed } from "./scope-filter";
export type {
	ManagedMcpServer,
	McpHealthResult,
	McpScope,
	McpServerState,
	McpTransport,
	SkillMcpConfig,
} from "./types";
export {
	mcpScopeSchema,
	mcpTransportSchema,
	skillMcpConfigSchema,
} from "./types";

let globalMcpManager: InstanceType<typeof import("./manager").McpLifecycleManager> | null = null;

export function setGlobalMcpManager(
	manager: InstanceType<typeof import("./manager").McpLifecycleManager>,
): void {
	globalMcpManager = manager;
}

export function getGlobalMcpManager(): InstanceType<
	typeof import("./manager").McpLifecycleManager
> | null {
	return globalMcpManager;
}
