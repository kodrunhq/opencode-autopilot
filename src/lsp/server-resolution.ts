import { getConfigPaths, getMergedServers, loadAllConfigs } from "./server-config-loader";
import { BUILTIN_SERVERS, LSP_INSTALL_HINTS } from "./server-definitions";
import { isServerInstalled } from "./server-installation";
import type { LspCapability, ResolvedServer, ServerLookupResult } from "./types";

function compareServerRichness(left: ResolvedServer, right: ResolvedServer): number {
	return right.capabilities.length - left.capabilities.length || right.priority - left.priority;
}

function matchesExtension(
	server: ResolvedServer,
	extension: string,
	requiredCapability?: LspCapability,
): boolean {
	if (!server.extensions.includes(extension)) {
		return false;
	}

	if (!requiredCapability) {
		return true;
	}

	return server.capabilities.includes(requiredCapability);
}

function getMatchingServers(
	servers: readonly ResolvedServer[],
	extension: string,
	requiredCapability?: LspCapability,
): readonly ResolvedServer[] {
	return servers.filter((server) => matchesExtension(server, extension, requiredCapability));
}

function getBestInstalledServer(
	servers: readonly ResolvedServer[],
	extension: string,
	requiredCapability?: LspCapability,
): ResolvedServer | undefined {
	const installedCandidates = getMatchingServers(servers, extension, requiredCapability).filter(
		(server) => isServerInstalled(server.command),
	);

	if (installedCandidates.length === 0) {
		return undefined;
	}

	if (requiredCapability) {
		const sortedCandidates = [...installedCandidates];
		sortedCandidates.sort(compareServerRichness);
		return sortedCandidates[0];
	}

	const bestPriority = Math.max(...installedCandidates.map((server) => server.priority));
	const topPriorityCandidates = installedCandidates.filter(
		(server) => server.priority === bestPriority,
	);
	topPriorityCandidates.sort(compareServerRichness);
	return topPriorityCandidates[0];
}

function getBestUninstalledServer(
	servers: readonly ResolvedServer[],
	extension: string,
	requiredCapability?: LspCapability,
): ResolvedServer | undefined {
	const candidates = [...getMatchingServers(servers, extension, requiredCapability)];

	if (!requiredCapability) {
		return candidates[0];
	}

	candidates.sort(compareServerRichness);
	return candidates[0];
}

export function findServerForExtension(
	extension: string,
	requiredCapability?: LspCapability,
): ServerLookupResult {
	const servers = getMergedServers();
	const installedServer = getBestInstalledServer(servers, extension, requiredCapability);
	if (installedServer) {
		return { status: "found", server: installedServer };
	}

	const uninstalledServer = getBestUninstalledServer(servers, extension, requiredCapability);
	if (uninstalledServer) {
		return {
			status: "not_installed",
			installHint:
				LSP_INSTALL_HINTS[uninstalledServer.id] ??
				`Install '${uninstalledServer.command[0]}' and ensure it's in your PATH`,
			server: {
				command: uninstalledServer.command,
				extensions: uninstalledServer.extensions,
				id: uninstalledServer.id,
			},
		};
	}

	return {
		status: "not_configured",
		extension,
		availableServers: Array.from(new Set(servers.map((server) => server.id))),
	};
}

export function getAllServers(): readonly {
	readonly id: string;
	readonly installed: boolean;
	readonly extensions: readonly string[];
	readonly capabilities: readonly LspCapability[];
	readonly disabled: boolean;
	readonly source: string;
	readonly priority: number;
}[] {
	const disabled = new Set<string>();
	for (const config of loadAllConfigs().values()) {
		for (const [id, entry] of Object.entries(config.lsp ?? {})) {
			if (entry.disabled) disabled.add(id);
		}
	}

	const seen = new Set<string>();
	const resolved = getMergedServers().flatMap((server) => {
		if (seen.has(server.id)) return [];
		seen.add(server.id);
		return [
			{
				capabilities: server.capabilities,
				disabled: false,
				extensions: server.extensions,
				id: server.id,
				installed: isServerInstalled(server.command),
				priority: server.priority,
				source: server.source,
			},
		];
	});

	const disabledOnly = [...disabled].flatMap((id) => {
		if (seen.has(id)) return [];
		const server = BUILTIN_SERVERS[id];
		return [
			{
				capabilities: server?.capabilities ?? [],
				disabled: true,
				extensions: server?.extensions ?? [],
				id,
				installed: server ? isServerInstalled(server.command) : false,
				priority: 0,
				source: "disabled",
			},
		];
	});

	return [...resolved, ...disabledOnly];
}

export function getConfigPathsForDebug(): Readonly<
	Record<"project" | "user" | "opencode", string>
> {
	return getConfigPaths();
}
