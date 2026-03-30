import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { ensureDir } from "./utils/fs-helpers";

export interface PluginConfig {
	readonly version: 1;
	readonly configured: boolean;
	readonly models: Readonly<Record<string, string>>;
}

export const CONFIG_PATH = join(
	homedir(),
	".config",
	"opencode",
	"opencode-assets.json",
);

export async function loadConfig(
	configPath: string = CONFIG_PATH,
): Promise<PluginConfig | null> {
	try {
		const raw = await readFile(configPath, "utf-8");
		return JSON.parse(raw) as PluginConfig;
	} catch (error: unknown) {
		if (
			error instanceof Error &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			return null;
		}
		throw error;
	}
}

export async function saveConfig(
	config: PluginConfig,
	configPath: string = CONFIG_PATH,
): Promise<void> {
	await ensureDir(dirname(configPath));
	await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function isFirstLoad(config: PluginConfig | null): boolean {
	return config === null || !config.configured;
}

export function createDefaultConfig(): PluginConfig {
	return { version: 1, configured: false, models: {} };
}
