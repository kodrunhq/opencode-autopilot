import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearContextDiscoveryCache, discoverContextFiles } from "../../src/context/discovery";

describe("discoverContextFiles", () => {
	let tempDir: string;

	beforeEach(async () => {
		clearContextDiscoveryCache();
		tempDir = await mkdtemp(join(tmpdir(), "context-discovery-"));
	});

	afterEach(async () => {
		clearContextDiscoveryCache();
		await rm(tempDir, { recursive: true, force: true });
	});

	test("discovers context files across the project hierarchy", async () => {
		const workspaceRoot = join(tempDir, "workspace");
		const parentRoot = join(workspaceRoot, "parent");
		const projectRoot = join(parentRoot, "project");

		await mkdir(join(workspaceRoot, ".opencode"), { recursive: true });
		await mkdir(projectRoot, { recursive: true });
		await writeFile(join(projectRoot, "AGENTS.md"), "project agents", "utf-8");
		await writeFile(join(projectRoot, "README.md"), "project readme", "utf-8");
		await writeFile(join(parentRoot, "CLAUDE.md"), "parent claude", "utf-8");
		await writeFile(join(workspaceRoot, ".opencode", "agents.md"), "workspace agents", "utf-8");
		await writeFile(join(workspaceRoot, "README.md"), "workspace readme", "utf-8");

		const sources = await discoverContextFiles({ projectRoot });

		expect(sources.map((source) => source.name)).toEqual([
			"AGENTS.md",
			"CLAUDE.md",
			".opencode/agents.md",
			"README.md",
			"README.md",
		]);

		const projectReadme = sources.find(
			(source) => source.filePath === join(projectRoot, "README.md"),
		);
		const workspaceReadme = sources.find(
			(source) => source.filePath === join(workspaceRoot, "README.md"),
		);

		expect(projectReadme?.priority).toBeGreaterThan(workspaceReadme?.priority ?? 0);
		expect(projectReadme?.tokenEstimate).toBe(Math.ceil("project readme".length / 4));
	});

	test("returns an empty array when no context files exist", async () => {
		const projectRoot = join(tempDir, "empty-project");
		await mkdir(projectRoot, { recursive: true });

		const sources = await discoverContextFiles({ projectRoot });

		expect(sources).toEqual([]);
	});
});
