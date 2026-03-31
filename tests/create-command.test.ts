import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommandCore } from "../src/tools/create-command";

describe("createCommandCore", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "oc-test-cmd-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("writes command markdown file to commands directory", async () => {
		const result = await createCommandCore(
			{
				name: "review",
				description: "Run a code review on the current file",
			},
			tempDir,
		);

		expect(result).toContain("review");
		expect(result).toContain("Restart OpenCode");

		const filePath = join(tempDir, "commands", "review.md");
		const content = await readFile(filePath, "utf-8");
		expect(content).toContain("description: Run a code review on the current file");
	});

	it("includes agent and model when provided", async () => {
		const result = await createCommandCore(
			{
				name: "quick-fix",
				description: "Apply a quick fix",
				agent: "code-reviewer",
				model: "anthropic/claude-haiku-3.5",
			},
			tempDir,
		);

		expect(result).toContain("quick-fix");
		const filePath = join(tempDir, "commands", "quick-fix.md");
		const content = await readFile(filePath, "utf-8");
		expect(content).toContain("agent: code-reviewer");
		expect(content).toContain("model: anthropic/claude-haiku-3.5");
	});

	it("returns validation error for invalid name", async () => {
		const result = await createCommandCore(
			{
				name: "My Command!",
				description: "Invalid",
			},
			tempDir,
		);

		expect(result).toContain("invalid");
	});

	it("returns error for built-in command name", async () => {
		const result = await createCommandCore(
			{
				name: "help",
				description: "Try to override help",
			},
			tempDir,
		);

		expect(result).toContain("built-in");
	});

	it("returns error when command already exists", async () => {
		await createCommandCore(
			{
				name: "my-cmd",
				description: "First version",
			},
			tempDir,
		);

		const result = await createCommandCore(
			{
				name: "my-cmd",
				description: "Second version",
			},
			tempDir,
		);

		expect(result).toContain("already exists");
	});
});
