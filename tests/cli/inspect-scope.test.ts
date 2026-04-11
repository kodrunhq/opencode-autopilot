import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { inspectCliCore } from "../../bin/inspect";
import { runKernelMigrations } from "../../src/kernel/migrations";
import { initMemoryDb } from "../../src/memory/database";
import { insertObservation } from "../../src/memory/repository";
import { resolveProjectIdentitySync } from "../../src/projects/resolve";
import { getAutopilotDbPath, getProjectArtifactDir } from "../../src/utils/paths";

const NOW = "2026-04-05T12:00:00.000Z";
const INSPECT_MODULE_URL = new URL("../../bin/inspect.ts", import.meta.url).href;

interface InspectProjectsResponse {
	readonly action: "inspect_projects";
	readonly dbPath: string;
	readonly dbScope: string;
	readonly note?: string;
	readonly projects: readonly Array<{
		readonly id: string;
		readonly name: string;
		readonly path: string;
	}>;
}

interface InspectMemoryResponse {
	readonly action: "inspect_memory";
	readonly overview: {
		readonly stats: {
			readonly totalObservations: number;
		};
		readonly recentObservations: readonly Array<{
			readonly summary: string;
		}>;
	};
}

function openInitializedDb(dbPath: string): Database {
	const db = new Database(dbPath);
	initMemoryDb(db);
	runKernelMigrations(db);
	return db;
}

function ensureDirectory(path: string): void {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

function registerProject(db: Database, projectRoot: string, projectId: string): string {
	return resolveProjectIdentitySync(projectRoot, {
		db,
		now: () => NOW,
		readGitFingerprint: () => null,
		createProjectId: () => projectId,
	}).id;
}

function runInspectProjectsJsonInSubprocess(homeDir: string): InspectProjectsResponse {
	const script = [
		`const { inspectCliCore } = await import(${JSON.stringify(INSPECT_MODULE_URL)});`,
		'const result = await inspectCliCore(["projects", "--json"]);',
		"process.stdout.write(result.output);",
	].join(" ");

	const output = execSync(`bun --eval ${JSON.stringify(script)}`, {
		encoding: "utf-8",
		env: {
			...process.env,
			HOME: homeDir,
		},
		stdio: ["pipe", "pipe", "pipe"],
	});

	return JSON.parse(output) as InspectProjectsResponse;
}

describe("CLI inspect scope", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "inspect-scope-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("inspect projects uses global DB when --global flag is set", async () => {
		const globalDbPath = getAutopilotDbPath(tempDir);
		const projectArtifactDir = getProjectArtifactDir(tempDir);
		const projectKernelPath = join(projectArtifactDir, "kernel.db");
		ensureDirectory(projectArtifactDir);

		const globalDb = openInitializedDb(globalDbPath);
		const projectDb = openInitializedDb(projectKernelPath);

		try {
			registerProject(globalDb, "/home/user/global-project", "project-global");
			registerProject(projectDb, "/home/user/project-kernel", "project-kernel");
		} finally {
			globalDb.close();
			projectDb.close();
		}

		const result = await inspectCliCore(["projects", "--global", "--json"], {
			dbPath: globalDbPath,
		});
		const parsed = JSON.parse(result.output) as InspectProjectsResponse;

		expect(result.isError).toBe(false);
		expect(result.output).toContain("global-project");
		expect(result.output).not.toContain("project-kernel");
		expect(parsed.action).toBe("inspect_projects");
		expect(parsed.dbScope).toBe("explicit");
		expect(parsed.dbPath).toBe(globalDbPath);
		expect(parsed.projects).toHaveLength(1);
		expect(parsed.projects[0]?.name).toBe("global-project");
	});

	test("inspect memory always uses global DB even when project kernel exists", async () => {
		const globalDbPath = getAutopilotDbPath(tempDir);
		const projectArtifactDir = getProjectArtifactDir(tempDir);
		const projectKernelPath = join(projectArtifactDir, "kernel.db");
		ensureDirectory(projectArtifactDir);

		const globalDb = openInitializedDb(globalDbPath);
		const projectDb = openInitializedDb(projectKernelPath);

		try {
			const globalProjectId = registerProject(
				globalDb,
				"/home/user/global-memory-project",
				"project-memory-global",
			);
			registerProject(projectDb, "/home/user/project-memory-kernel", "project-memory-kernel");

			insertObservation(
				{
					projectId: globalProjectId,
					sessionId: "session-memory-global",
					type: "decision",
					content: "Remember the global observation",
					summary: "global observation",
					confidence: 0.9,
					accessCount: 0,
					createdAt: NOW,
					lastAccessed: NOW,
				},
				globalDb,
			);
		} finally {
			globalDb.close();
			projectDb.close();
		}

		const result = await inspectCliCore(["memory", "--json"], { dbPath: globalDbPath });
		const parsed = JSON.parse(result.output) as InspectMemoryResponse;

		expect(result.isError).toBe(false);
		expect(result.output).toContain("global observation");
		expect(parsed.action).toBe("inspect_memory");
		expect(parsed.overview.stats.totalObservations).toBe(1);
		expect(parsed.overview.recentObservations[0]?.summary).toBe("global observation");
	});

	test("inspect projects defaults to current-project scope inside git repo", async () => {
		const gitRepoDir = await mkdtemp(join(tmpdir(), "repo-under-test-"));
		const gitRepoName = basename(gitRepoDir);
		const homeDir = await mkdtemp(join(tmpdir(), "home-under-test-"));
		const originalHome = process.env.HOME;
		const originalCwd = process.cwd();

		try {
			execSync("git init", { cwd: gitRepoDir, stdio: "pipe" });

			process.env.HOME = homeDir;
			const globalDbPath = getAutopilotDbPath(join(homeDir, ".config", "opencode"));
			mkdirSync(dirname(globalDbPath), { recursive: true });

			const db = openInitializedDb(globalDbPath);
			try {
				registerProject(db, gitRepoDir, "current-repo-project");
				registerProject(db, "/home/user/other-project", "other-project");
			} finally {
				db.close();
			}

			process.chdir(gitRepoDir);

			const parsed = runInspectProjectsJsonInSubprocess(homeDir);

			expect(parsed.action).toBe("inspect_projects");
			expect(parsed.dbPath).toBe(globalDbPath);
			expect(parsed.note).toBe("Showing current repo project. Use --global to list all projects.");
			expect(parsed.projects).toHaveLength(1);
			expect(parsed.projects[0]?.name).toBe(gitRepoName);
			expect(parsed.projects[0]?.path).toBe(gitRepoDir);
			expect(parsed.projects[0]?.id).toBe("current-repo-project");
			expect(JSON.stringify(parsed)).not.toContain("other-project");
		} finally {
			process.chdir(originalCwd);
			process.env.HOME = originalHome;
			await rm(gitRepoDir, { recursive: true, force: true });
			await rm(homeDir, { recursive: true, force: true });
		}
	});

	test("inspect projects filters ephemeral test projects by default", async () => {
		const gitRepoDir = await mkdtemp(join(tmpdir(), "repo-under-test-"));
		const homeDir = await mkdtemp(join(tmpdir(), "home-under-test-"));
		const originalHome = process.env.HOME;
		const originalCwd = process.cwd();

		try {
			execSync("git init", { cwd: gitRepoDir, stdio: "pipe" });

			process.env.HOME = homeDir;
			const globalDbPath = getAutopilotDbPath(join(homeDir, ".config", "opencode"));
			mkdirSync(dirname(globalDbPath), { recursive: true });

			const db = openInitializedDb(globalDbPath);
			try {
				registerProject(db, "/tmp/forensics-project-abc", "ephemeral-test");
				registerProject(db, "/tmp/review-tool-xyz", "ephemeral-review");
				registerProject(db, "/home/user/real-project", "real-project");
			} finally {
				db.close();
			}

			process.chdir(gitRepoDir);

			const parsed = runInspectProjectsJsonInSubprocess(homeDir);

			expect(parsed.action).toBe("inspect_projects");
			expect(parsed.dbPath).toBe(globalDbPath);
			expect(parsed.note).toBe(
				"No project record found for current repo in the selected database. Use --global to list all projects.",
			);
			expect(parsed.projects).toHaveLength(0);
		} finally {
			process.chdir(originalCwd);
			process.env.HOME = originalHome;
			await rm(gitRepoDir, { recursive: true, force: true });
			await rm(homeDir, { recursive: true, force: true });
		}
	});

	test("inspect projects does not filter ephemeral when explicit dbPath is provided", async () => {
		const dbPath = getAutopilotDbPath(tempDir);
		const db = openInitializedDb(dbPath);

		try {
			registerProject(db, "/tmp/forensics-project-abc", "project-ephemeral");
			registerProject(db, "/home/user/real-project", "project-real");
		} finally {
			db.close();
		}

		const result = await inspectCliCore(["projects"], { dbPath });

		expect(result.isError).toBe(false);
		expect(result.output).toContain("real-project");
		expect(result.output).toContain("forensics-project-abc");
	});

	test("hides macOS ephemeral test projects under /var/folders/.../T/", async () => {
		const dbPath = getAutopilotDbPath(tempDir);
		const db = openInitializedDb(dbPath);

		try {
			registerProject(
				db,
				"/var/folders/xx/xxxxxxxxxxx/T/forensics-project-abc",
				"project-macos-ephemeral",
			);
			registerProject(db, "/var/folders/xx/xxxxxxxxxxx/T/real-project", "project-macos-real");
		} finally {
			db.close();
		}

		// prune-ephemeral exercises isEphemeralPath() directly
		const result = await inspectCliCore(["--prune-ephemeral", "--json"], { dbPath });
		const parsed = JSON.parse(result.output) as {
			action: string;
			pruned: number;
		};

		expect(result.isError).toBe(false);
		expect(parsed.action).toBe("prune_ephemeral");
		expect(parsed.pruned).toBe(1);

		// Verify the remaining project is the non-ephemeral one
		const remaining = await inspectCliCore(["projects"], { dbPath });
		expect(remaining.output).not.toContain("forensics-project-abc");
		expect(remaining.output).toContain("real-project");
	});

	test("prune-ephemeral without view returns prune result, not help", async () => {
		const dbPath = getAutopilotDbPath(tempDir);
		const db = openInitializedDb(dbPath);

		try {
			registerProject(db, "/tmp/forensics-project-old", "project-to-prune");
			registerProject(db, "/home/user/keep-project", "project-keep");
		} finally {
			db.close();
		}

		const result = await inspectCliCore(["--prune-ephemeral", "--json"], { dbPath });
		const parsed = JSON.parse(result.output) as {
			action: string;
			pruned: number;
			dbPath: string;
		};

		expect(result.isError).toBe(false);
		expect(parsed.action).toBe("prune_ephemeral");
		expect(parsed.pruned).toBe(1);
		expect(parsed.dbPath).toBe(dbPath);
	});
});
