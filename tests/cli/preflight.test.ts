import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectCliCore } from "../../bin/inspect";
import { createDefaultConfig, saveConfig } from "../../src/config";
import { getProjectArtifactDir } from "../../src/utils/paths";

describe("CLI preflight", () => {
	let tempDir = "";
	let projectRoot = "";
	let configPath = "";
	let originalCwd = "";

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "cli-preflight-"));
		projectRoot = join(tempDir, "repo");
		configPath = join(tempDir, "opencode-autopilot.json");
		originalCwd = process.cwd();

		await mkdir(projectRoot, { recursive: true });
		await writeFile(join(projectRoot, "package.json"), JSON.stringify({ name: "repo" }), "utf-8");
		execSync("git init", { cwd: projectRoot, stdio: "pipe" });
		process.chdir(projectRoot);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		await rm(tempDir, { recursive: true, force: true });
	});

	test("preflight reports mixed artifact state and missing verification profile", async () => {
		await saveConfig(createDefaultConfig(), configPath);
		await writeFile(join(projectRoot, "kernel.db"), "legacy", "utf-8");
		await mkdir(getProjectArtifactDir(projectRoot), { recursive: true });

		const result = await inspectCliCore(["preflight", "--json"], { configPath });
		const parsed = JSON.parse(result.output) as {
			action: string;
			issues: ReadonlyArray<{ code: string; severity: string; source: string }>;
		};

		expect(result.isError).toBe(false);
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
				expect.objectContaining({
					code: "missing_verification_profile",
					severity: "warning",
					source: "config",
				}),
			]),
		);
	});
});
