import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { ensureDir, isEnoentError } from "./utils/fs-helpers";

const pluginConfigSchema = z.object({
	version: z.literal(1),
	configured: z.boolean(),
	models: z.record(z.string(), z.string()),
});

export type PluginConfig = z.infer<typeof pluginConfigSchema>;

export const CONFIG_PATH = join(homedir(), ".config", "opencode", "opencode-assets.json");

export async function loadConfig(configPath: string = CONFIG_PATH): Promise<PluginConfig | null> {
	try {
		const raw = await readFile(configPath, "utf-8");
		const parsed = JSON.parse(raw);
		return pluginConfigSchema.parse(parsed);
	} catch (error: unknown) {
		if (isEnoentError(error)) {
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
