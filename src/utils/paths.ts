import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dir ?? dirname(fileURLToPath(import.meta.url));

export function getGlobalConfigDir(): string {
	return join(homedir(), ".config", "opencode");
}

export function getAssetsDir(): string {
	return join(__dirname, "..", "..", "assets");
}
