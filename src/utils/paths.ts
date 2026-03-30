import { homedir } from "node:os";
import { join } from "node:path";

export function getGlobalConfigDir(): string {
	return join(homedir(), ".config", "opencode");
}

export function getAssetsDir(): string {
	return join(import.meta.dir, "..", "..", "assets");
}
