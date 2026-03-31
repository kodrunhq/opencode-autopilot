import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentCore } from "../src/tools/create-agent";

describe("createAgentCore", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "oc-test-agent-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("writes agent markdown file to agents directory", async () => {
		const result = await createAgentCore(
			{
				name: "code-reviewer",
				description: "Reviews code for quality",
				mode: "subagent",
			},
			tempDir,
		);

		expect(result).toContain("code-reviewer");
		expect(result).toContain("Restart OpenCode");

		const filePath = join(tempDir, "agents", "code-reviewer.md");
		const content = await readFile(filePath, "utf-8");
		expect(content).toContain("description: Reviews code for quality");
		expect(content).toContain("mode: subagent");
	});

	it("includes model and temperature when provided", async () => {
		const result = await createAgentCore(
			{
				name: "fast-helper",
				description: "A fast helper agent",
				mode: "primary",
				model: "anthropic/claude-haiku-3.5",
				temperature: 0.3,
			},
			tempDir,
		);

		expect(result).toContain("fast-helper");
		const filePath = join(tempDir, "agents", "fast-helper.md");
		const content = await readFile(filePath, "utf-8");
		expect(content).toContain("model: anthropic/claude-haiku-3.5");
		expect(content).toContain("temperature: 0.3");
	});

	it("returns validation error for invalid name", async () => {
		const result = await createAgentCore(
			{
				name: "Invalid Name!",
				description: "Bad agent",
				mode: "subagent",
			},
			tempDir,
		);

		expect(result).toContain("invalid");
	});

	it("returns error when agent file already exists", async () => {
		// Create agent first
		await createAgentCore(
			{
				name: "my-agent",
				description: "First version",
				mode: "subagent",
			},
			tempDir,
		);

		// Try to create again
		const result = await createAgentCore(
			{
				name: "my-agent",
				description: "Second version",
				mode: "subagent",
			},
			tempDir,
		);

		expect(result).toContain("already exists");
	});

	it("returns error for empty name", async () => {
		const result = await createAgentCore(
			{
				name: "",
				description: "No name agent",
				mode: "subagent",
			},
			tempDir,
		);

		expect(result).toContain("Name must be");
	});
});
