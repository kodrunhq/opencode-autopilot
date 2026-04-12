import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoopContext } from "../../src/autonomy/types";
import { resolveVerificationCommands, VerificationHandler } from "../../src/autonomy/verification";
import { createDefaultConfig } from "../../src/config";

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
		oracleVerification: null,
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
			commandChecks: [
				{ name: "tests", command: "run-tests" },
				{ name: "lint", command: "run-lint" },
			],
			runCommand: async () => ({ exitCode: 0, output: "ok" }),
			artifactPaths: [artifactPath],
		});

		const result = await handler.verify(createContext());

		expect(result.passed).toBe(true);
		expect(result.status).toBe("PASSED");
		expect(result.checks).toHaveLength(3);
		expect(result.checks.every((check) => check.passed)).toBe(true);
	});

	test("fails when tests command fails", async () => {
		const handler = new VerificationHandler({
			commandChecks: [
				{ name: "tests", command: "run-tests" },
				{ name: "lint", command: "run-lint" },
			],
			runCommand: async (command) =>
				command === "run-tests"
					? { exitCode: 1, output: "test failure" }
					: { exitCode: 0, output: "ok" },
			artifactPaths: [artifactPath],
		});

		const result = await handler.verify(createContext());

		expect(result.passed).toBe(false);
		expect(result.status).toBe("FAILED");
		expect(result.checks.find((check) => check.name === "tests")?.passed).toBe(false);
	});

	test("reports partial failure when lint fails", async () => {
		const handler = new VerificationHandler({
			commandChecks: [
				{ name: "tests", command: "run-tests" },
				{ name: "lint", command: "run-lint" },
			],
			runCommand: async (command) =>
				command === "run-lint"
					? { exitCode: 2, output: "lint failure" }
					: { exitCode: 0, output: "ok" },
			artifactPaths: [artifactPath],
		});

		const result = await handler.verify(createContext());

		expect(result.passed).toBe(false);
		expect(result.status).toBe("FAILED");
		expect(result.checks.find((check) => check.name === "lint")?.message).toContain("lint failure");
	});

	test("handles thrown command errors without crashing", async () => {
		const handler = new VerificationHandler({
			commandChecks: [{ name: "tests", command: "run-tests" }],
			runCommand: async () => {
				throw new Error("runner unavailable");
			},
			artifactPaths: [join(tempDir, "missing.txt")],
		});

		const result = await handler.verify(createContext());

		expect(result.passed).toBe(false);
		expect(result.status).toBe("FAILED");
		expect(result.checks.find((check) => check.name === "tests")?.message).toContain(
			"runner unavailable",
		);
		expect(result.checks.find((check) => check.name === "artifacts")?.passed).toBe(false);
	});

	test("fails closed when no command runner is available", async () => {
		const bunGlobal = globalThis as typeof globalThis & {
			readonly Bun?: { spawn?: typeof Bun.spawn };
		};
		const originalSpawn = bunGlobal.Bun?.spawn;

		if (bunGlobal.Bun) {
			// biome-ignore lint/suspicious/noExplicitAny: test-only mutation of Bun runtime surface
			(bunGlobal.Bun as any).spawn = undefined;
		}

		try {
			const handler = new VerificationHandler({
				commandChecks: [
					{ name: "tests", command: "run-tests" },
					{ name: "lint", command: "run-lint" },
				],
			});
			const result = await handler.verify(createContext());

			expect(result.passed).toBe(false);
			expect(result.status).toBe("BLOCKED");
			expect(result.checks.find((check) => check.name === "tests")?.message).toContain(
				"no command runner configured",
			);
			expect(result.checks.find((check) => check.name === "lint")?.message).toContain(
				"no command runner configured",
			);
		} finally {
			if (bunGlobal.Bun) {
				// biome-ignore lint/suspicious/noExplicitAny: test-only mutation of Bun runtime surface
				(bunGlobal.Bun as any).spawn = originalSpawn;
			}
		}
	});

	test("spawns verification commands inside each configured project root", async () => {
		const rootA = await mkdtemp(join(tmpdir(), "autonomy-verification-worktree-a-"));
		const rootB = await mkdtemp(join(tmpdir(), "autonomy-verification-worktree-b-"));
		const bunGlobal = globalThis as typeof globalThis & {
			readonly Bun?: { spawn?: typeof Bun.spawn };
		};
		const originalSpawn = bunGlobal.Bun?.spawn;
		const spawnedCwds: Array<string | undefined> = [];

		if (bunGlobal.Bun) {
			// biome-ignore lint/suspicious/noExplicitAny: test-only mutation of Bun runtime surface
			(bunGlobal.Bun as any).spawn = ((_command: string[], options?: { readonly cwd?: string }) => {
				spawnedCwds.push(options?.cwd);
				const stdout = new Response(options?.cwd ?? "").body;
				const stderr = new Response("").body;
				return {
					stdout,
					stderr,
					exited: Promise.resolve(0),
				};
			}) as typeof Bun.spawn;
		}

		try {
			const [resultA, resultB] = await Promise.all([
				new VerificationHandler({
					projectRoot: rootA,
					commandChecks: [{ name: "tests", command: "echo root" }],
				}).verify(createContext()),
				new VerificationHandler({
					projectRoot: rootB,
					commandChecks: [{ name: "tests", command: "echo root" }],
				}).verify(createContext()),
			]);

			expect(resultA.passed).toBe(true);
			expect(resultA.status).toBe("PASSED");
			expect(resultB.passed).toBe(true);
			expect(resultB.status).toBe("PASSED");
			expect(spawnedCwds.sort()).toEqual([rootA, rootB].sort());
		} finally {
			if (bunGlobal.Bun) {
				// biome-ignore lint/suspicious/noExplicitAny: test-only mutation of Bun runtime surface
				(bunGlobal.Bun as any).spawn = originalSpawn;
			}
			await rm(rootA, { recursive: true, force: true });
			await rm(rootB, { recursive: true, force: true });
		}
	});

	test("treats an empty verification profile as blocked", async () => {
		const handler = new VerificationHandler({
			commandChecks: [],
			runCommand: async () => ({ exitCode: 0, output: "ok" }),
		});

		const result = await handler.verify(createContext());

		expect(result.passed).toBe(false);
		expect(result.status).toBe("BLOCKED");
		expect(result.checks[0]?.message).toContain("No verification commands configured");
	});

	test("resolves verification commands from project package manager and scripts", async () => {
		await writeFile(
			join(tempDir, "package.json"),
			JSON.stringify({
				packageManager: "pnpm@9.0.0",
				scripts: {
					test: "vitest",
					lint: "eslint .",
				},
			}),
			"utf-8",
		);

		const commands = await resolveVerificationCommands(tempDir);

		expect(commands).toEqual([
			{ name: "tests", command: "pnpm run test" },
			{ name: "lint", command: "pnpm run lint" },
		]);
	});

	test("falls back to npm commands when package manager detection is unavailable", async () => {
		await writeFile(
			join(tempDir, "package.json"),
			JSON.stringify({
				scripts: {
					test: "vitest",
					lint: "eslint .",
				},
			}),
			"utf-8",
		);

		const commands = await resolveVerificationCommands(tempDir);

		expect(commands).toEqual([
			{ name: "tests", command: "npm run test" },
			{ name: "lint", command: "npm run lint" },
		]);
	});

	test("prefers project-local verification config over global overrides and keeps roots isolated", async () => {
		const rootA = await mkdtemp(join(tmpdir(), "autonomy-verification-project-a-"));
		const rootB = await mkdtemp(join(tmpdir(), "autonomy-verification-project-b-"));

		try {
			await mkdir(join(rootA, ".opencode"), { recursive: true });
			await writeFile(
				join(rootA, ".opencode", "config.json"),
				JSON.stringify({
					verification: {
						commandChecks: [{ name: "tests", command: "local-a" }],
					},
				}),
				"utf-8",
			);

			const globalConfig = {
				...createDefaultConfig(),
				verification: {
					commandChecks: [{ name: "tests", command: "global-default" }],
					projectOverrides: {
						[rootB]: { commandChecks: [{ name: "tests", command: "global-b" }] },
					},
				},
			};

			const [commandsA, commandsB] = await Promise.all([
				resolveVerificationCommands(rootA, globalConfig),
				resolveVerificationCommands(rootB, globalConfig),
			]);

			expect(commandsA).toEqual([{ name: "tests", command: "local-a" }]);
			expect(commandsB).toEqual([{ name: "tests", command: "global-b" }]);
		} finally {
			await rm(rootA, { recursive: true, force: true });
			await rm(rootB, { recursive: true, force: true });
		}
	});
});
