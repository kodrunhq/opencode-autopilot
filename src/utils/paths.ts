import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dir ?? dirname(fileURLToPath(import.meta.url));
const AUTOPILOT_DB_FILE = "autopilot.db";
const LEGACY_MEMORY_DIR = "memory";
const LEGACY_MEMORY_DB_FILE = "memory.db";

export const PROJECT_ARTIFACT_DIR_NAME = ".opencode-autopilot";
export const PROJECT_KERNEL_DB_FILE = "kernel.db";

const PROJECT_ROOT_SIGNALS = Object.freeze([
	".git",
	"package.json",
	"tsconfig.json",
	"Cargo.toml",
	"go.mod",
	"pom.xml",
]);

export const PROJECT_RUNTIME_FILE_NAMES = Object.freeze([
	"state.json",
	"current-review.json",
	"orchestration.jsonl",
	"review-memory.json",
	"lesson-memory.json",
]);

export const PROJECT_ROOT_AUTOPILOT_FILE_NAMES = Object.freeze([
	PROJECT_KERNEL_DB_FILE,
	`${PROJECT_KERNEL_DB_FILE}-wal`,
	`${PROJECT_KERNEL_DB_FILE}-shm`,
	...PROJECT_RUNTIME_FILE_NAMES,
]);

const SAFE_RUNTIME_CLEANUP_FILE_NAMES = Object.freeze(["state.json", "current-review.json"]);

export const PROJECT_RUNTIME_TEMP_FILE_PREFIXES = Object.freeze([
	...PROJECT_RUNTIME_FILE_NAMES.map((fileName) => `${fileName}.tmp.`),
	`${PROJECT_KERNEL_DB_FILE}.tmp.`,
]);

export interface ProjectArtifactIssue {
	readonly code: string;
	readonly severity: "error" | "warning";
	readonly message: string;
	readonly paths: readonly string[];
}

export interface ProjectArtifactState {
	readonly projectRoot: string;
	readonly artifactDir: string;
	readonly artifactDirExists: boolean;
	readonly rootArtifactPaths: readonly string[];
	readonly legacyRootKernelDbPresent: boolean;
	readonly mixedArtifactState: boolean;
	readonly issues: readonly ProjectArtifactIssue[];
}

export interface ProjectRuntimeCleanupResult {
	readonly projectRoot: string;
	readonly artifactDir: string;
	readonly removedPaths: readonly string[];
	readonly skippedPaths: readonly string[];
}

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

export function looksLikeProjectRoot(dirPath: string): boolean {
	const resolvedPath = resolve(dirPath);
	const name = basename(resolvedPath);
	if (name === PROJECT_ARTIFACT_DIR_NAME || name === PROJECT_KERNEL_DB_FILE) {
		return false;
	}

	for (const signal of PROJECT_ROOT_SIGNALS) {
		if (existsSync(join(resolvedPath, signal))) {
			return true;
		}
	}

	return false;
}

export function getProjectArtifactDir(projectRoot: string): string {
	return join(resolve(projectRoot), PROJECT_ARTIFACT_DIR_NAME);
}

export function isProjectArtifactDir(path: string): boolean {
	return basename(resolve(path)) === PROJECT_ARTIFACT_DIR_NAME;
}

export function getProjectRootFromArtifactDir(artifactDir: string): string {
	const resolvedPath = resolve(artifactDir);
	return isProjectArtifactDir(resolvedPath) ? dirname(resolvedPath) : resolvedPath;
}

export function isPathInsideDirectory(targetPath: string, directoryPath: string): boolean {
	const relativePath = relative(resolve(directoryPath), resolve(targetPath));
	return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

export function findEnclosingProjectRoot(path: string): string | null {
	let currentPath = resolve(path);
	while (true) {
		if (looksLikeProjectRoot(currentPath)) {
			return currentPath;
		}

		const parentPath = dirname(currentPath);
		if (parentPath === currentPath) {
			return null;
		}

		currentPath = parentPath;
	}
}

export function assertProjectArtifactOwnership(targetPath: string): string {
	const resolvedTargetPath = resolve(targetPath);
	const projectRoot = findEnclosingProjectRoot(resolvedTargetPath);
	if (projectRoot === null) {
		return resolvedTargetPath;
	}

	const artifactDir = getProjectArtifactDir(projectRoot);
	if (!isPathInsideDirectory(resolvedTargetPath, artifactDir)) {
		throw new Error(
			`Autopilot project artifacts for "${projectRoot}" must live under "${artifactDir}". Refusing runtime path "${resolvedTargetPath}".`,
		);
	}

	return resolvedTargetPath;
}

export function listProjectRootAutopilotArtifacts(projectRoot: string): readonly string[] {
	const resolvedProjectRoot = resolve(projectRoot);
	return Object.freeze(
		PROJECT_ROOT_AUTOPILOT_FILE_NAMES.map((fileName) => join(resolvedProjectRoot, fileName)).filter(
			(filePath) => existsSync(filePath),
		),
	);
}

function createProjectArtifactIssue(
	code: string,
	severity: "error" | "warning",
	message: string,
	paths: readonly string[],
): ProjectArtifactIssue {
	return Object.freeze({ code, severity, message, paths: Object.freeze([...paths]) });
}

export function inspectProjectArtifactState(projectRoot: string): ProjectArtifactState {
	const resolvedProjectRoot = resolve(projectRoot);
	const artifactDir = getProjectArtifactDir(resolvedProjectRoot);
	const rootArtifactPaths = listProjectRootAutopilotArtifacts(resolvedProjectRoot);
	const legacyRootKernelPaths = rootArtifactPaths.filter(
		(filePath) => basename(filePath) === PROJECT_KERNEL_DB_FILE,
	);
	const mixedArtifactState = existsSync(artifactDir) && rootArtifactPaths.length > 0;
	const issues: ProjectArtifactIssue[] = [];

	if (legacyRootKernelPaths.length > 0) {
		issues.push(
			createProjectArtifactIssue(
				"legacy_root_kernel_db_present",
				"error",
				"Legacy repo-root kernel.db artifacts are present. Autopilot project artifacts must stay inside .opencode-autopilot/.",
				legacyRootKernelPaths,
			),
		);
	}

	const nonKernelRootArtifacts = rootArtifactPaths.filter(
		(filePath) => basename(filePath) !== PROJECT_KERNEL_DB_FILE,
	);
	if (nonKernelRootArtifacts.length > 0) {
		issues.push(
			createProjectArtifactIssue(
				"project_root_runtime_artifacts_present",
				"error",
				"Repo-root autopilot runtime files are present outside .opencode-autopilot/.",
				nonKernelRootArtifacts,
			),
		);
	}

	if (mixedArtifactState) {
		issues.push(
			createProjectArtifactIssue(
				"mixed_artifact_state",
				"error",
				"Mixed artifact state detected: repo-root autopilot files exist alongside the canonical .opencode-autopilot/ directory.",
				rootArtifactPaths,
			),
		);
	}

	return Object.freeze({
		projectRoot: resolvedProjectRoot,
		artifactDir,
		artifactDirExists: existsSync(artifactDir),
		rootArtifactPaths,
		legacyRootKernelDbPresent: legacyRootKernelPaths.length > 0,
		mixedArtifactState,
		issues: Object.freeze(issues),
	});
}

export async function cleanupProjectRuntimeArtifacts(
	projectRoot: string,
): Promise<ProjectRuntimeCleanupResult> {
	const resolvedProjectRoot = resolve(projectRoot);
	const artifactDir = getProjectArtifactDir(resolvedProjectRoot);
	const removedPaths: string[] = [];
	const skippedPaths: string[] = [];

	if (!existsSync(artifactDir)) {
		return Object.freeze({
			projectRoot: resolvedProjectRoot,
			artifactDir,
			removedPaths: Object.freeze(removedPaths),
			skippedPaths: Object.freeze(skippedPaths),
		});
	}

	const entries = await readdir(artifactDir);
	const kernelDbPath = join(artifactDir, PROJECT_KERNEL_DB_FILE);
	const kernelDbExists = existsSync(kernelDbPath);

	for (const entry of entries) {
		const isSafeRuntimeFile = SAFE_RUNTIME_CLEANUP_FILE_NAMES.includes(entry);
		const isSafeTempFile = PROJECT_RUNTIME_TEMP_FILE_PREFIXES.some((prefix) =>
			entry.startsWith(prefix),
		);
		if (!isSafeRuntimeFile && !isSafeTempFile) {
			continue;
		}

		const targetPath = join(artifactDir, entry);
		if (entry === "state.json" && !kernelDbExists) {
			skippedPaths.push(targetPath);
			continue;
		}

		await rm(targetPath, { force: true, recursive: true });
		removedPaths.push(targetPath);
	}

	return Object.freeze({
		projectRoot: resolvedProjectRoot,
		artifactDir,
		removedPaths: Object.freeze(removedPaths),
		skippedPaths: Object.freeze(skippedPaths),
	});
}
