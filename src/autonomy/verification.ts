import { access } from "node:fs/promises";
import type { LoopContext, VerificationCheck, VerificationResult } from "./types";

export interface CommandExecutionResult {
	readonly exitCode: number;
	readonly output: string;
}

export interface VerificationHandlerDeps {
	readonly runCommand?: (command: string) => Promise<CommandExecutionResult>;
	readonly artifactPaths?: readonly string[];
}

function createCheck(name: string, passed: boolean, message: string): VerificationCheck {
	return Object.freeze({ name, passed, message });
}

export class VerificationHandler {
	constructor(private readonly deps: VerificationHandlerDeps = {}) {}

	async verify(_context: LoopContext): Promise<VerificationResult> {
		const checks = await Promise.all([
			this.checkTestsPass(),
			this.checkLintClean(),
			this.checkArtifactsExist(this.deps.artifactPaths ?? []),
		]);

		return Object.freeze({
			passed: checks.every((check) => check.passed),
			checks: Object.freeze(checks),
			timestamp: new Date().toISOString(),
		});
	}

	async checkTestsPass(): Promise<VerificationCheck> {
		return this.runCommandCheck("tests", "bun test");
	}

	async checkLintClean(): Promise<VerificationCheck> {
		return this.runCommandCheck("lint", "bun run lint");
	}

	async checkArtifactsExist(paths: readonly string[]): Promise<VerificationCheck> {
		if (paths.length === 0) {
			return createCheck("artifacts", true, "No artifact paths configured");
		}

		try {
			const missingPaths: string[] = [];
			for (const path of paths) {
				try {
					await access(path);
				} catch {
					missingPaths.push(path);
				}
			}

			if (missingPaths.length > 0) {
				return createCheck("artifacts", false, `Missing artifacts: ${missingPaths.join(", ")}`);
			}

			return createCheck("artifacts", true, `Verified ${paths.length} artifact(s)`);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return createCheck("artifacts", false, `Artifact check failed: ${message}`);
		}
	}

	private async runCommandCheck(name: string, command: string): Promise<VerificationCheck> {
		if (!this.deps.runCommand) {
			return createCheck(name, true, `Skipped ${command}: no command runner configured`);
		}

		try {
			const result = await this.deps.runCommand(command);
			if (result.exitCode === 0) {
				return createCheck(name, true, `${command} passed`);
			}

			return createCheck(name, false, `${command} failed: ${result.output}`);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return createCheck(name, false, `${command} failed: ${message}`);
		}
	}
}
