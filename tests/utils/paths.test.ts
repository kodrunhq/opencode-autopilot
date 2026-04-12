import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
	assertProjectArtifactOwnership,
	cleanupProjectRuntimeArtifacts,
	getAssetsDir,
	getAutopilotDbPath,
	getGlobalConfigDir,
	getLegacyMemoryDbPath,
	getProjectArtifactDir,
	inspectProjectArtifactState,
	isProjectArtifactDir,
} from "../../src/utils/paths";

describe("getGlobalConfigDir", () => {
	test("returns path containing .config/opencode", () => {
		const result = getGlobalConfigDir();
		expect(result).toContain(join(".config", "opencode"));
	});

	test("returns an absolute path", () => {
		const result = getGlobalConfigDir();
		expect(isAbsolute(result)).toBe(true);
	});
});

describe("getAssetsDir", () => {
	test("returns path ending with assets", () => {
		const result = getAssetsDir();
		expect(result.endsWith("assets")).toBe(true);
	});

	test("returns an absolute path", () => {
		const result = getAssetsDir();
		expect(isAbsolute(result)).toBe(true);
	});
});

describe("getAutopilotDbPath", () => {
	test("returns path containing .config/opencode/autopilot.db", () => {
		const result = getAutopilotDbPath();
		expect(result).toContain(join(".config", "opencode", "autopilot.db"));
	});

	test("returns an absolute path", () => {
		const result = getAutopilotDbPath();
		expect(isAbsolute(result)).toBe(true);
	});
});

describe("getLegacyMemoryDbPath", () => {
	test("returns path containing .config/opencode/memory/memory.db", () => {
		const result = getLegacyMemoryDbPath();
		expect(result).toContain(join(".config", "opencode", "memory", "memory.db"));
	});
});

describe("isProjectArtifactDir", () => {
	test("returns true for .opencode-autopilot directory", () => {
		expect(isProjectArtifactDir("/tmp/project/.opencode-autopilot")).toBe(true);
	});

	test("returns false for project root", () => {
		expect(isProjectArtifactDir("/tmp/project")).toBe(false);
	});
});

describe("project artifact invariants", () => {
	let tempDir = "";
	let projectRoot = "";

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "paths-test-"));
		projectRoot = join(tempDir, "repo");
		await mkdir(projectRoot, { recursive: true });
		await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "repo" }), "utf-8");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("assertProjectArtifactOwnership rejects project subdirectories outside .opencode-autopilot", () => {
		expect(() => assertProjectArtifactOwnership(join(projectRoot, "tmp"))).toThrow(
			"must live under",
		);
	});

	test("inspectProjectArtifactState reports mixed repo-root artifacts", async () => {
		const artifactDir = getProjectArtifactDir(projectRoot);
		await mkdir(artifactDir, { recursive: true });
		await writeFile(join(projectRoot, "kernel.db"), "legacy", "utf-8");
		await writeFile(join(projectRoot, "state.json"), "legacy-state", "utf-8");

		const result = inspectProjectArtifactState(projectRoot);

		expect(result.legacyRootKernelDbPresent).toBe(true);
		expect(result.mixedArtifactState).toBe(true);
		expect(result.issues.map((issue) => issue.code)).toEqual(
			expect.arrayContaining([
				"legacy_root_kernel_db_present",
				"project_root_runtime_artifacts_present",
				"mixed_artifact_state",
			]),
		);
	});

	test("cleanupProjectRuntimeArtifacts removes safe mirror files when kernel db exists", async () => {
		const artifactDir = getProjectArtifactDir(projectRoot);
		await mkdir(artifactDir, { recursive: true });
		await writeFile(join(artifactDir, "kernel.db"), "db", "utf-8");
		await writeFile(join(artifactDir, "state.json"), "state", "utf-8");
		await writeFile(join(artifactDir, "current-review.json"), "review", "utf-8");
		await writeFile(join(artifactDir, "lesson-memory.json"), "keep", "utf-8");

		const result = await cleanupProjectRuntimeArtifacts(projectRoot);

		expect(result.removedPaths).toEqual(
			expect.arrayContaining([
				join(artifactDir, "state.json"),
				join(artifactDir, "current-review.json"),
			]),
		);
		expect(existsSync(join(artifactDir, "state.json"))).toBe(false);
		expect(existsSync(join(artifactDir, "current-review.json"))).toBe(false);
		expect(existsSync(join(artifactDir, "lesson-memory.json"))).toBe(true);
	});
});
