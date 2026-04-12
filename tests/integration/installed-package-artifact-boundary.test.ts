import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createDefaultConfig, saveConfig } from "../../src/config";
import { getProjectArtifactDir } from "../../src/utils/paths";

const REPO_ROOT = new URL("../../", import.meta.url);

async function createInstalledPackageDir(rootDir: string): Promise<string> {
	const packageDir = join(rootDir, "installed-package");
	await mkdir(packageDir, { recursive: true });
	for (const entry of ["src", "bin", "assets", "node_modules"] as const) {
		await symlink(new URL(entry, REPO_ROOT), join(packageDir, entry), "dir");
	}
	await symlink(new URL("package.json", REPO_ROOT), join(packageDir, "package.json"), "file");
	return packageDir;
}

describe("installed package artifact boundary", () => {
	let tempDir = "";
	let homeDir = "";
	let packageDir = "";

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "installed-boundary-"));
		homeDir = join(tempDir, "home");
		await mkdir(homeDir, { recursive: true });
		packageDir = await createInstalledPackageDir(tempDir);
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("local installed-package run keeps kernel.db and runtime state out of repo root", async () => {
		const projectRoot = join(tempDir, "repo-run");
		await mkdir(projectRoot, { recursive: true });
		await writeFile(
			join(projectRoot, "package.json"),
			JSON.stringify({ name: "repo-run" }),
			"utf-8",
		);

		const script = [
			`const { openProjectKernelDb } = await import(${JSON.stringify(pathToFileURL(join(packageDir, "src/kernel/database.ts")).href)});`,
			`const { getProjectArtifactDir, cleanupProjectRuntimeArtifacts } = await import(${JSON.stringify(pathToFileURL(join(packageDir, "src/utils/paths.ts")).href)});`,
			`const { createInitialState, saveState } = await import(${JSON.stringify(pathToFileURL(join(packageDir, "src/orchestrator/state.ts")).href)});`,
			'const { writeFile } = await import("node:fs/promises");',
			'const { join } = await import("node:path");',
			"const projectRoot = process.env.PROJECT_ROOT;",
			'if (!projectRoot) throw new Error("PROJECT_ROOT is required");',
			"const artifactDir = getProjectArtifactDir(projectRoot);",
			"const db = openProjectKernelDb(projectRoot);",
			"db.close();",
			'await saveState(createInitialState("artifact-boundary"), artifactDir);',
			'await writeFile(join(artifactDir, "current-review.json"), JSON.stringify({ stage: 1 }), "utf-8");',
			"await cleanupProjectRuntimeArtifacts(projectRoot);",
		].join(" ");

		execFileSync("bun", ["--eval", script], {
			cwd: packageDir,
			env: {
				...process.env,
				HOME: homeDir,
				PROJECT_ROOT: projectRoot,
			},
			stdio: ["pipe", "pipe", "pipe"],
		});

		const artifactDir = getProjectArtifactDir(projectRoot);
		expect(existsSync(join(projectRoot, "kernel.db"))).toBe(false);
		expect(existsSync(join(projectRoot, "kernel.db-wal"))).toBe(false);
		expect(existsSync(join(projectRoot, "kernel.db-shm"))).toBe(false);
		expect(existsSync(join(projectRoot, "state.json"))).toBe(false);
		expect(existsSync(join(projectRoot, "current-review.json"))).toBe(false);
		expect(existsSync(join(artifactDir, "kernel.db"))).toBe(true);
		expect(existsSync(join(artifactDir, "state.json"))).toBe(false);
		expect(existsSync(join(artifactDir, "current-review.json"))).toBe(false);
	});

	test("installed inspect preflight reports mixed legacy states clearly", async () => {
		const projectRoot = join(tempDir, "repo-preflight");
		await mkdir(projectRoot, { recursive: true });
		await writeFile(
			join(projectRoot, "package.json"),
			JSON.stringify({ name: "repo-preflight" }),
			"utf-8",
		);
		execSync("git init", { cwd: projectRoot, stdio: "pipe" });

		const configPath = join(homeDir, ".config", "opencode", "opencode-autopilot.json");
		await mkdir(join(homeDir, ".config", "opencode"), { recursive: true });
		await saveConfig(createDefaultConfig(), configPath);

		const artifactDir = getProjectArtifactDir(projectRoot);
		await mkdir(artifactDir, { recursive: true });
		await writeFile(join(projectRoot, "kernel.db"), "legacy", "utf-8");

		const output = execFileSync(
			"bun",
			[join(packageDir, "bin", "cli.ts"), "inspect", "preflight", "--json"],
			{
				cwd: projectRoot,
				encoding: "utf-8",
				env: {
					...process.env,
					HOME: homeDir,
				},
				stdio: ["pipe", "pipe", "pipe"],
			},
		);

		const parsed = JSON.parse(output) as {
			action: string;
			issues: ReadonlyArray<{ code: string; severity: string; source: string }>;
		};

		expect(parsed.action).toBe("inspect_preflight");
		expect(parsed.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "legacy_root_kernel_db_present",
					severity: "error",
					source: "artifacts",
				}),
				expect.objectContaining({
					code: "mixed_artifact_state",
					severity: "error",
					source: "artifacts",
				}),
			]),
		);
	});
});
