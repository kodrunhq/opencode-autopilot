import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonc } from "../utils/opencode-config";
import { getGlobalConfigDir } from "../utils/paths";
import { BUILTIN_SERVERS } from "./server-definitions";
import type { LspCapability, ResolvedServer } from "./types";

interface LspEntry {
	readonly disabled?: boolean;
	readonly command?: readonly string[];
	readonly extensions?: readonly string[];
	readonly capabilities?: readonly LspCapability[];
	readonly priority?: number;
	readonly env?: Readonly<Record<string, string>>;
	readonly initialization?: Readonly<Record<string, unknown>>;
}

interface ConfigJson {
	readonly lsp?: Readonly<Record<string, LspEntry>>;
}

type ConfigSource = "project" | "user" | "opencode";

interface ServerWithSource extends ResolvedServer {
	readonly source: ConfigSource;
}

export function loadJsonFile<T>(filePath: string): T | null {
	if (!existsSync(filePath)) return null;
	try {
		return parseJsonc(readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}

export function getConfigPaths(): Readonly<Record<ConfigSource, string>> {
	const cwd = process.cwd();
	const configDir = getGlobalConfigDir();
	const localOpenCodeDir = join(cwd, ".opencode");
	// Use .opencode.json (with leading dot) per current OpenCode standard
	const opencodeCandidates = [
		join(localOpenCodeDir, ".opencode.json"),
		join(localOpenCodeDir, ".opencode.jsonc"),
		join(configDir, ".opencode.json"),
		join(configDir, ".opencode.jsonc"),
	];
	const opencode =
		opencodeCandidates.find((candidate) => existsSync(candidate)) ?? opencodeCandidates[2];
	return {
		opencode,
		project: join(localOpenCodeDir, "opencode-autopilot.json"),
		user: join(configDir, "opencode-autopilot.json"),
	};
}

export function loadAllConfigs(): ReadonlyMap<ConfigSource, ConfigJson> {
	const paths = getConfigPaths();
	const configs = new Map<ConfigSource, ConfigJson>();
	for (const source of ["project", "user", "opencode"] as const) {
		const loaded = loadJsonFile<ConfigJson>(paths[source]);
		if (loaded) configs.set(source, loaded);
	}
	return configs;
}

export function getMergedServers(): readonly ServerWithSource[] {
	const configs = loadAllConfigs();
	const disabled = new Set<string>();
	const seen = new Set<string>();
	const merged: ServerWithSource[] = [];

	for (const source of ["project", "user", "opencode"] as const) {
		const entries = configs.get(source)?.lsp;
		if (!entries) continue;
		for (const [id, entry] of Object.entries(entries)) {
			if (entry.disabled) {
				disabled.add(id);
				continue;
			}
			if (seen.has(id) || !entry.command || !entry.extensions) continue;
			merged.push({
				command: [...entry.command],
				capabilities: [...(entry.capabilities ?? [])],
				env: entry.env,
				extensions: [...entry.extensions],
				id,
				initialization: entry.initialization,
				priority: entry.priority ?? 0,
				source,
			});
			seen.add(id);
		}
	}

	for (const [id, server] of Object.entries(BUILTIN_SERVERS)) {
		if (disabled.has(id) || seen.has(id)) continue;
		merged.push({
			command: [...server.command],
			capabilities: [...(server.capabilities ?? [])],
			extensions: [...server.extensions],
			id,
			priority: -100,
			source: "opencode",
		});
	}

	const order: Readonly<Record<ConfigSource, number>> = { project: 0, user: 1, opencode: 2 };
	return merged.sort(
		(left, right) => order[left.source] - order[right.source] || right.priority - left.priority,
	);
}
