import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installAssets } from "../src/installer";
import { fileExists } from "../src/utils/fs-helpers";

describe("installAssets", () => {
	let sourceDir: string;
	let targetDir: string;

	beforeEach(async () => {
		const base = join(tmpdir(), `opencode-installer-test-${Date.now()}`);
		sourceDir = join(base, "assets");
		targetDir = join(base, "target");
		await mkdir(join(sourceDir, "agents"), { recursive: true });
		await mkdir(join(sourceDir, "commands"), { recursive: true });
		await mkdir(join(sourceDir, "skills"), { recursive: true });
		await mkdir(targetDir, { recursive: true });
	});

	afterEach(async () => {
		const base = join(sourceDir, "..");
		await rm(base, { recursive: true, force: true });
	});

	test("copies agent file to target", async () => {
		const agentContent = "---\ndescription: Test agent\n---\nHello";
		await writeFile(join(sourceDir, "agents", "test-agent.md"), agentContent);

		const result = await installAssets(sourceDir, targetDir);

		expect(result.copied).toContain("agents/test-agent.md");
		expect(result.errors).toHaveLength(0);

		const targetContent = await readFile(join(targetDir, "agents", "test-agent.md"), "utf-8");
		expect(targetContent).toBe(agentContent);
	});

	test("skips file that already exists at target", async () => {
		await writeFile(join(sourceDir, "agents", "existing.md"), "source content");
		await mkdir(join(targetDir, "agents"), { recursive: true });
		await writeFile(join(targetDir, "agents", "existing.md"), "user customized content");

		const result = await installAssets(sourceDir, targetDir);

		expect(result.skipped).toContain("agents/existing.md");
		expect(result.copied).not.toContain("agents/existing.md");

		// Verify user's content was NOT overwritten
		const content = await readFile(join(targetDir, "agents", "existing.md"), "utf-8");
		expect(content).toBe("user customized content");
	});

	test("copies command files", async () => {
		await writeFile(
			join(sourceDir, "commands", "configure.md"),
			"---\ndescription: Configure\n---\nRun oc_configure",
		);

		const result = await installAssets(sourceDir, targetDir);

		expect(result.copied).toContain("commands/configure.md");
		expect(await fileExists(join(targetDir, "commands", "configure.md"))).toBe(true);
	});

	test("copies skill directory structure", async () => {
		const skillDir = join(sourceDir, "skills", "test-skill");
		await mkdir(skillDir, { recursive: true });
		await writeFile(join(skillDir, "SKILL.md"), "# Test Skill");

		const result = await installAssets(sourceDir, targetDir);

		expect(result.copied).toContain("skills/test-skill/SKILL.md");
		expect(await fileExists(join(targetDir, "skills", "test-skill", "SKILL.md"))).toBe(true);
	});

	test("skips .gitkeep files", async () => {
		await writeFile(join(sourceDir, "agents", ".gitkeep"), "");

		const result = await installAssets(sourceDir, targetDir);

		expect(result.copied).not.toContain("agents/.gitkeep");
		expect(result.skipped).not.toContain("agents/.gitkeep");
		expect(await fileExists(join(targetDir, "agents", ".gitkeep"))).toBe(false);
	});

	test("creates target directories if they do not exist", async () => {
		const freshTarget = join(targetDir, "fresh");
		await writeFile(join(sourceDir, "agents", "new-agent.md"), "agent content");

		const result = await installAssets(sourceDir, freshTarget);

		expect(result.copied).toContain("agents/new-agent.md");
		expect(await fileExists(join(freshTarget, "agents", "new-agent.md"))).toBe(true);
	});

	test("returns empty arrays when no assets exist", async () => {
		const result = await installAssets(sourceDir, targetDir);

		expect(result.copied).toHaveLength(0);
		expect(result.skipped).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});

	test("populates errors array when source file is unreadable", async () => {
		const { chmod } = await import("node:fs/promises");
		const agentPath = join(sourceDir, "agents", "unreadable.md");
		await writeFile(agentPath, "content");
		await chmod(agentPath, 0o000);

		const result = await installAssets(sourceDir, targetDir);

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toContain("agents/unreadable.md");

		// Restore permissions for cleanup
		await chmod(agentPath, 0o644);
	});
});
