import type { McpScope } from "./types";

export type McpToolAction = "read" | "write" | "execute";

export interface ScopeViolation {
	readonly serverName: string;
	readonly skillName: string;
	readonly requestedAction: McpToolAction;
	readonly allowedScopes: readonly McpScope[];
	readonly toolName: string;
}

export function isActionAllowed(
	action: McpToolAction,
	allowedScopes: readonly McpScope[],
): boolean {
	return allowedScopes.includes(action);
}

export function filterByScope(
	toolName: string,
	action: McpToolAction,
	serverName: string,
	skillName: string,
	allowedScopes: readonly McpScope[],
): { allowed: boolean; violation: ScopeViolation | null } {
	if (isActionAllowed(action, allowedScopes)) {
		return Object.freeze({
			allowed: true,
			violation: null,
		});
	}

	return Object.freeze({
		allowed: false,
		violation: Object.freeze({
			serverName,
			skillName,
			requestedAction: action,
			allowedScopes: Object.freeze([...allowedScopes]),
			toolName,
		}),
	});
}
