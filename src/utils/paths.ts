import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dir ?? dirname(fileURLToPath(import.meta.url));
const AUTOPILOT_DB_FILE = "autopilot.db";
const LEGACY_MEMORY_DIR = "memory";
const LEGACY_MEMORY_DB_FILE = "memory.db";

export function getGlobalConfigDir(): string {
	return join(homedir(), ".config", "opencode");
}

export function getAutopilotDbPath(baseDir?: string): string {
	return join(baseDir ?? getGlobalConfigDir(), AUTOPILOT_DB_FILE);
}

export function getLegacyMemoryDbPath(baseDir?: string): string {
	return join(baseDir ?? getGlobalConfigDir(), LEGACY_MEMORY_DIR, LEGACY_MEMORY_DB_FILE);
}

export function getAssetsDir(): string {
	return join(__dirname, "..", "..", "assets");
}

export function getProjectArtifactDir(projectRoot: string): string {
	return join(projectRoot, ".opencode-autopilot");
}

export function isProjectArtifactDir(path: string): boolean {
	return basename(path) === ".opencode-autopilot";
}

export function getProjectRootFromArtifactDir(artifactDir: string): string {
	return isProjectArtifactDir(artifactDir) ? dirname(artifactDir) : artifactDir;
}
