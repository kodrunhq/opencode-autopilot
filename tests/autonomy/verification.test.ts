import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoopContext } from "../../src/autonomy/types";
import { VerificationHandler } from "../../src/autonomy/verification";

function createContext(): LoopContext {
	return {
		taskDescription: "verify changes",
		maxIterations: 3,
		currentIteration: 1,
		state: "verifying",
		startedAt: new Date().toISOString(),
		lastIterationAt: new Date().toISOString(),
		accumulatedContext: [],
		verificationResults: [],
	};
}

describe("VerificationHandler", () => {
	let tempDir: string;
	let artifactPath: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "autonomy-verification-"));
		artifactPath = join(tempDir, "artifact.txt");
		await writeFile(artifactPath, "ok", "utf-8");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("passes when commands succeed and artifacts exist", async () => {
		const handler = new VerificationHandler({
			runCommand: async () => ({ exitCode: 0, output: "ok" }),
			artifactPaths: [artifactPath],
		});

		const result = await handler.verify(createContext());

		expect(result.passed).toBe(true);
		expect(result.checks).toHaveLength(3);
		expect(result.checks.every((check) => check.passed)).toBe(true);
	});

	test("fails when tests command fails", async () => {
		const handler = new VerificationHandler({
			runCommand: async (command) =>
				command === "bun test"
					? { exitCode: 1, output: "test failure" }
					: { exitCode: 0, output: "ok" },
			artifactPaths: [artifactPath],
		});

		const result = await handler.verify(createContext());

		expect(result.passed).toBe(false);
		expect(result.checks.find((check) => check.name === "tests")?.passed).toBe(false);
	});

	test("reports partial failure when lint fails", async () => {
		const handler = new VerificationHandler({
			runCommand: async (command) =>
				command === "bun run lint"
					? { exitCode: 2, output: "lint failure" }
					: { exitCode: 0, output: "ok" },
			artifactPaths: [artifactPath],
		});

		const result = await handler.verify(createContext());

		expect(result.passed).toBe(false);
		expect(result.checks.find((check) => check.name === "lint")?.message).toContain("lint failure");
	});

	test("handles thrown command errors without crashing", async () => {
		const handler = new VerificationHandler({
			runCommand: async () => {
				throw new Error("runner unavailable");
			},
			artifactPaths: [join(tempDir, "missing.txt")],
		});

		const result = await handler.verify(createContext());

		expect(result.passed).toBe(false);
		expect(result.checks.find((check) => check.name === "tests")?.message).toContain(
			"runner unavailable",
		);
		expect(result.checks.find((check) => check.name === "artifacts")?.passed).toBe(false);
	});
});
