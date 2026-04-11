import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { getAutopilotDbPath, getProjectArtifactDir } from "../utils/paths";
import { runKernelMigrations } from "./migrations";

export const KERNEL_DB_FILE = "kernel.db";

const LEGACY_KERNEL_FILES = Object.freeze([
	KERNEL_DB_FILE,
	`${KERNEL_DB_FILE}-wal`,
	`${KERNEL_DB_FILE}-shm`,
]);

function resolveArtifactDir(path: string): string {
	if (basename(path) === ".opencode-autopilot") {
		return path;
	}

	const artifactDir = getProjectArtifactDir(path);
	const legacyKernelPath = join(path, KERNEL_DB_FILE);
	const artifactKernelPath = join(artifactDir, KERNEL_DB_FILE);

	// If a legacy root-level kernel exists, migrate it into the artifact directory.
	if (existsSync(legacyKernelPath) && !existsSync(artifactKernelPath)) {
		mkdirSync(artifactDir, { recursive: true });
		for (const file of LEGACY_KERNEL_FILES) {
			const legacyFile = join(path, file);
			if (existsSync(legacyFile)) {
				renameSync(legacyFile, join(artifactDir, file));
			}
		}
		return artifactDir;
	}

	return artifactDir;
}

export function detectLegacyKernelDb(projectRoot: string): string | null {
	const legacyPath = join(projectRoot, KERNEL_DB_FILE);
	return existsSync(legacyPath) ? legacyPath : null;
}

export function migrateLegacyKernelDb(projectRoot: string): string | null {
	const legacyPath = detectLegacyKernelDb(projectRoot);
	if (!legacyPath) return null;

	const artifactDir = getProjectArtifactDir(projectRoot);
	const target = join(artifactDir, KERNEL_DB_FILE);
	mkdirSync(artifactDir, { recursive: true });

	if (existsSync(target)) {
		return target;
	}

	for (const file of LEGACY_KERNEL_FILES) {
		const legacyFile = join(projectRoot, file);
		if (existsSync(legacyFile)) {
			renameSync(legacyFile, join(artifactDir, file));
		}
	}
	return target;
}

export function resolveKernelDbPathFromProject(
	projectRoot: string,
	options?: { migrateLegacy?: boolean },
): {
	path: string;
	kind: "artifact" | "legacy" | "migrated" | "missing" | "artifact_with_legacy";
} {
	const artifactDir = getProjectArtifactDir(projectRoot);
	const artifactPath = join(artifactDir, KERNEL_DB_FILE);
	const hasArtifact = existsSync(artifactPath);
	const legacyPath = detectLegacyKernelDb(projectRoot);
	if (hasArtifact && legacyPath) {
		return { path: artifactPath, kind: "artifact_with_legacy" };
	}
	if (hasArtifact) {
		return { path: artifactPath, kind: "artifact" };
	}

	if (legacyPath) {
		if (options?.migrateLegacy) {
			const migrated = migrateLegacyKernelDb(projectRoot);
			return { path: migrated ?? artifactPath, kind: "migrated" };
		}
		return { path: legacyPath, kind: "legacy" };
	}

	return { path: artifactPath, kind: "missing" };
}

export function getKernelDbPath(artifactDirOrProjectRoot?: string): string {
	if (
		typeof artifactDirOrProjectRoot === "string" &&
		artifactDirOrProjectRoot.length > 0
	) {
		// If caller passed an explicit file path ending in kernel.db, honor it directly.
		if (artifactDirOrProjectRoot.endsWith(KERNEL_DB_FILE)) {
			return artifactDirOrProjectRoot;
		}

		// Allow project root inputs by resolving to the artifact directory (with legacy migration).
		const artifactDir = resolveArtifactDir(artifactDirOrProjectRoot);
		return join(artifactDir, KERNEL_DB_FILE);
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

	const database = new Database(
		dbPath,
		options?.readonly ? { readonly: true } : undefined,
	);

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
	migrateLegacyKernelDb(projectRoot);
	const artifactDir = getProjectArtifactDir(projectRoot);
	return openKernelDb(artifactDir, options);
}
