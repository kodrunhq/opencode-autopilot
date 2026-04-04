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
			join(sourceDir, "commands", "new-agent.md"),
			"---\ndescription: New Agent\n---\nCreate a new agent",
		);

		const result = await installAssets(sourceDir, targetDir);

		expect(result.copied).toContain("commands/new-agent.md");
		expect(await fileExists(join(targetDir, "commands", "new-agent.md"))).toBe(true);
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

	test("copies template files to target", async () => {
		await mkdir(join(sourceDir, "templates"), { recursive: true });
		const templateContent = "# Web API Starter\n\nAgents for web API projects.";
		await writeFile(join(sourceDir, "templates", "web-api.md"), templateContent);

		const result = await installAssets(sourceDir, targetDir);

		expect(result.copied).toContain("templates/web-api.md");
		expect(result.errors).toHaveLength(0);

		const targetContent = await readFile(join(targetDir, "templates", "web-api.md"), "utf-8");
		expect(targetContent).toBe(templateContent);
	});

	test("does not overwrite existing template files", async () => {
		await mkdir(join(sourceDir, "templates"), { recursive: true });
		await writeFile(join(sourceDir, "templates", "web-api.md"), "# Bundled Template");

		await mkdir(join(targetDir, "templates"), { recursive: true });
		const userContent = "# My Custom Template\n\nCustomized by user.";
		await writeFile(join(targetDir, "templates", "web-api.md"), userContent);

		const result = await installAssets(sourceDir, targetDir);

		expect(result.skipped).toContain("templates/web-api.md");
		expect(result.copied).not.toContain("templates/web-api.md");

		const preserved = await readFile(join(targetDir, "templates", "web-api.md"), "utf-8");
		expect(preserved).toBe(userContent);
	});

	test("returns empty arrays when no assets exist", async () => {
		const result = await installAssets(sourceDir, targetDir);

		expect(result.copied).toHaveLength(0);
		expect(result.skipped).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});

	test("removes deprecated assets that contain the opencode-autopilot marker", async () => {
		// Simulate a user upgrading from v3 who has old installer-generated command files
		await mkdir(join(targetDir, "commands"), { recursive: true });
		await writeFile(
			join(targetDir, "commands", "brainstorm.md"),
			"---\n# opencode-autopilot generated\n---\nold content",
		);
		await writeFile(
			join(targetDir, "commands", "tdd.md"),
			"---\n# opencode-autopilot generated\n---\nold content",
		);

		const result = await installAssets(sourceDir, targetDir);

		// Installer-generated deprecated files should be removed
		expect(await fileExists(join(targetDir, "commands", "brainstorm.md"))).toBe(false);
		expect(await fileExists(join(targetDir, "commands", "tdd.md"))).toBe(false);
		expect(result.errors).toHaveLength(0);
	});

	test("preserves deprecated assets that are user-created (no marker)", async () => {
		// Simulate a user who created their own brainstorm.md without the marker
		await mkdir(join(targetDir, "commands"), { recursive: true });
		await writeFile(join(targetDir, "commands", "brainstorm.md"), "my custom brainstorm command");

		const result = await installAssets(sourceDir, targetDir);

		// User-created file should be preserved
		expect(await fileExists(join(targetDir, "commands", "brainstorm.md"))).toBe(true);
		const content = await readFile(join(targetDir, "commands", "brainstorm.md"), "utf-8");
		expect(content).toBe("my custom brainstorm command");
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

	test("hasInstallerMarker deletes deprecated asset when marker is within 200 bytes", async () => {
		// "opencode-autopilot" is 18 bytes. Place it starting at byte 180 so it
		// ends at byte 198, well within the 200-byte read window.
		await mkdir(join(targetDir, "commands"), { recursive: true });
		const padding = " ".repeat(180);
		const content = padding + "opencode-autopilot\nold content after marker";
		await writeFile(join(targetDir, "commands", "brainstorm.md"), content);

		await installAssets(sourceDir, targetDir);

		expect(await fileExists(join(targetDir, "commands", "brainstorm.md"))).toBe(false);
	});

	test("hasInstallerMarker preserves deprecated asset when marker is beyond 200 bytes", async () => {
		// Pad with 201 bytes of spaces so "opencode-autopilot" starts at byte 201,
		// outside the 200-byte read window. The marker should NOT be detected.
		await mkdir(join(targetDir, "commands"), { recursive: true });
		const padding = " ".repeat(201);
		const content = padding + "opencode-autopilot\nold content after marker";
		await writeFile(join(targetDir, "commands", "brainstorm.md"), content);

		await installAssets(sourceDir, targetDir);

		// File should still exist because the marker was not found in the first 200 bytes
		expect(await fileExists(join(targetDir, "commands", "brainstorm.md"))).toBe(true);
	});
});
