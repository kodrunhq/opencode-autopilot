import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	assertProjectArtifactOwnership,
	getAutopilotDbPath,
	getProjectArtifactDir,
	looksLikeProjectRoot,
	PROJECT_KERNEL_DB_FILE,
} from "../utils/paths";
import { runKernelMigrations } from "./migrations";

export const KERNEL_DB_FILE = PROJECT_KERNEL_DB_FILE;

const LEGACY_KERNEL_FILES = Object.freeze([
	KERNEL_DB_FILE,
	`${KERNEL_DB_FILE}-wal`,
	`${KERNEL_DB_FILE}-shm`,
]);

export function detectLegacyKernelDb(projectRoot: string): string | null {
	const legacyPath = join(projectRoot, KERNEL_DB_FILE);
	return existsSync(legacyPath) ? legacyPath : null;
}

export function listLegacyKernelDbPaths(projectRoot: string): readonly string[] {
	return Object.freeze(
		LEGACY_KERNEL_FILES.map((fileName) => join(projectRoot, fileName)).filter((filePath) =>
			existsSync(filePath),
		),
	);
}

export interface ProjectKernelDbState {
	readonly projectRoot: string;
	readonly artifactDir: string;
	readonly artifactPath: string;
	readonly artifactExists: boolean;
	readonly legacyPaths: readonly string[];
	readonly mixedState: boolean;
}

export function inspectProjectKernelDbState(projectRoot: string): ProjectKernelDbState {
	const artifactDir = getProjectArtifactDir(projectRoot);
	const artifactPath = join(artifactDir, KERNEL_DB_FILE);
	const legacyPaths = listLegacyKernelDbPaths(projectRoot);
	const artifactExists = existsSync(artifactPath);

	return Object.freeze({
		projectRoot,
		artifactDir,
		artifactPath,
		artifactExists,
		legacyPaths,
		mixedState: artifactExists && legacyPaths.length > 0,
	});
}

export function migrateLegacyKernelDb(projectRoot: string): string | null {
	const legacyPaths = listLegacyKernelDbPaths(projectRoot);
	if (legacyPaths.length === 0) return null;

	const artifactDir = getProjectArtifactDir(projectRoot);
	const target = join(artifactDir, KERNEL_DB_FILE);
	mkdirSync(artifactDir, { recursive: true });

	for (const file of LEGACY_KERNEL_FILES) {
		const legacyFile = join(projectRoot, file);
		const targetFile = join(artifactDir, file);
		if (existsSync(legacyFile) && !existsSync(targetFile)) {
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
	const state = inspectProjectKernelDbState(projectRoot);
	const legacyPath = detectLegacyKernelDb(projectRoot);
	if (state.mixedState) {
		return { path: state.artifactPath, kind: "artifact_with_legacy" };
	}
	if (state.artifactExists) {
		return { path: state.artifactPath, kind: "artifact" };
	}

	if (legacyPath) {
		if (options?.migrateLegacy) {
			const migrated = migrateLegacyKernelDb(projectRoot);
			return { path: migrated ?? state.artifactPath, kind: "migrated" };
		}
		return { path: legacyPath, kind: "legacy" };
	}

	return { path: state.artifactPath, kind: "missing" };
}

export function getKernelDbPath(artifactDir?: string): string {
	if (typeof artifactDir === "string" && artifactDir.length > 0) {
		if (artifactDir.endsWith(KERNEL_DB_FILE)) {
			return assertProjectArtifactOwnership(artifactDir);
		}

		if (looksLikeProjectRoot(artifactDir)) {
			throw new Error(
				`openKernelDb: path "${artifactDir}" looks like a project root. Use openProjectKernelDb(projectRoot) for project-scoped access.`,
			);
		}

		const normalizedPath = assertProjectArtifactOwnership(artifactDir);

		return join(normalizedPath, KERNEL_DB_FILE);
	}

	return getAutopilotDbPath();
}

export function kernelDbExists(artifactDir?: string): boolean {
	return existsSync(getKernelDbPath(artifactDir));
}

export function openKernelDb(artifactDir?: string, options?: { readonly?: boolean }): Database {
	const dbPath = getKernelDbPath(artifactDir);
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
	if (!options?.readonly) {
		migrateLegacyKernelDb(projectRoot);
	}
	const artifactDir = assertProjectArtifactOwnership(getProjectArtifactDir(projectRoot));
	return openKernelDb(artifactDir, options);
}
