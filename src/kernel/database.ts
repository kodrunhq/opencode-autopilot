import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAutopilotDbPath, getProjectArtifactDir } from "../utils/paths";
import { runKernelMigrations } from "./migrations";

export const KERNEL_DB_FILE = "kernel.db";

export function getKernelDbPath(artifactDirOrProjectRoot?: string): string {
	if (typeof artifactDirOrProjectRoot === "string" && artifactDirOrProjectRoot.length > 0) {
		return join(artifactDirOrProjectRoot, KERNEL_DB_FILE);
	}

	return getAutopilotDbPath();
}

export function kernelDbExists(artifactDirOrProjectRoot?: string): boolean {
	return existsSync(getKernelDbPath(artifactDirOrProjectRoot));
}

export function openKernelDb(
	artifactDirOrProjectRoot?: string,
	options?: { readonly?: boolean },
): Database {
	const dbPath = getKernelDbPath(artifactDirOrProjectRoot);
	if (!options?.readonly) {
		mkdirSync(dirname(dbPath), { recursive: true });
	}

	const database = new Database(dbPath, options?.readonly ? { readonly: true } : undefined);

	database.run("PRAGMA foreign_keys=ON");
	database.run("PRAGMA busy_timeout=5000");

	if (!options?.readonly) {
		database.run("PRAGMA journal_mode=WAL");
		runKernelMigrations(database);
	}

	return database;
}

/**
 * Open the project-scoped kernel database at `<repo>/.opencode-autopilot/kernel.db`.
 * This is the ONLY valid way to open a kernel DB for project-scoped operations.
 * Never pass projectRoot directly into openKernelDb().
 */
export function openProjectKernelDb(
	projectRoot: string,
	options?: { readonly?: boolean },
): Database {
	const artifactDir = getProjectArtifactDir(projectRoot);
	return openKernelDb(artifactDir, options);
}
