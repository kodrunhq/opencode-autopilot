import { getConfigPaths, getMergedServers, loadAllConfigs } from "./server-config-loader";
import { BUILTIN_SERVERS, LSP_INSTALL_HINTS } from "./server-definitions";
import { isServerInstalled } from "./server-installation";
import type { ServerLookupResult } from "./types";

export function findServerForExtension(extension: string): ServerLookupResult {
	const servers = getMergedServers();
	for (const server of servers) {
		if (server.extensions.includes(extension) && isServerInstalled(server.command)) {
			return { status: "found", server };
		}
	}
	for (const server of servers) {
		if (server.extensions.includes(extension)) {
			return {
				status: "not_installed",
				installHint:
					LSP_INSTALL_HINTS[server.id] ??
					`Install '${server.command[0]}' and ensure it's in your PATH`,
				server: { command: server.command, extensions: server.extensions, id: server.id },
			};
		}
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
