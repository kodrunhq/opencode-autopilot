import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	type PluginConfig,
	projectVerificationConfigSchema,
	resolveProjectVerificationSettings,
} from "../config";
import type {
	LoopContext,
	VerificationCheck,
	VerificationCheckStatus,
	VerificationResult,
} from "./types";

export interface CommandExecutionResult {
	readonly exitCode: number;
	readonly output: string;
}

export interface VerificationHandlerDeps {
	readonly runCommand?: (command: string) => Promise<CommandExecutionResult>;
	readonly artifactPaths?: readonly string[];
	readonly commandChecks?: readonly VerificationCommand[];
	readonly config?: PluginConfig | null;
	readonly projectRoot?: string;
}

export interface VerificationCommand {
	readonly name: string;
	readonly command: string;
}

interface PackageJsonLike {
	readonly packageManager?: string;
	readonly scripts?: Readonly<Record<string, string>>;
}

const PACKAGE_MANAGER_LOCKFILES = Object.freeze([
	{ name: "bun", path: "bun.lock" },
	{ name: "pnpm", path: "pnpm-lock.yaml" },
	{ name: "yarn", path: "yarn.lock" },
	{ name: "npm", path: "package-lock.json" },
] as const);

const PROJECT_VERIFICATION_CONFIG_PATHS = Object.freeze([
	".opencode/config.json",
	".opencode/opencode-autopilot.json",
	".opencode-autopilot.json",
] as const);

function createDefaultVerificationCommands(
	packageManager: string = "npm",
): readonly VerificationCommand[] {
	return Object.freeze([
		{ name: "tests", command: commandForPackageManager(packageManager, "test") },
		{ name: "lint", command: commandForPackageManager(packageManager, "lint") },
	]);
}

function createDefaultCommandRunnerForProject(
	projectRoot: string,
): ((command: string) => Promise<CommandExecutionResult>) | null {
	if (typeof Bun === "undefined" || typeof Bun.spawn !== "function") {
		return null;
	}

	return async (command: string): Promise<CommandExecutionResult> => {
		const isWindows = typeof process !== "undefined" && process.platform === "win32";
		const spawnArgs = isWindows ? ["cmd", "/c", command] : ["bash", "-lc", command];
		const proc = Bun.spawn(spawnArgs, {
			cwd: projectRoot,
			stdout: "pipe",
			stderr: "pipe",
		});

		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		const output = [stdout.trimEnd(), stderr.trimEnd()]
			.filter((chunk) => chunk.length > 0)
			.join("\n");
		return { exitCode, output };
	};
}

function createCheck(
	name: string,
	status: VerificationCheckStatus,
	message: string,
): VerificationCheck {
	return Object.freeze({ name, passed: status === "PASSED", status, message });
}

function determineVerificationStatus(
	checks: readonly VerificationCheck[],
): VerificationResult["status"] {
	if (checks.some((check) => check.status === "FAILED")) {
		return "FAILED";
	}

	if (checks.some((check) => check.status === "BLOCKED")) {
		return "BLOCKED";
	}

	if (checks.some((check) => check.status === "PENDING")) {
		return "PENDING";
	}

	return "PASSED";
}

export function summarizeVerificationResult(result: VerificationResult): string {
	if (result.checks.length === 0) {
		return "No verification checks were recorded.";
	}

	const byStatus = {
		PASSED: 0,
		FAILED: 0,
		BLOCKED: 0,
		PENDING: 0,
		SKIPPED_WITH_REASON: 0,
	};

	for (const check of result.checks) {
		byStatus[check.status] += 1;
	}

	const parts = Object.entries(byStatus)
		.filter(([, count]) => count > 0)
		.map(([status, count]) => `${count} ${status}`);

	return `Verification ${result.status}: ${parts.join(", ")}.`;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function loadProjectVerificationCommands(
	projectRoot: string,
): Promise<readonly VerificationCommand[] | null> {
	for (const relativePath of PROJECT_VERIFICATION_CONFIG_PATHS) {
		const configPath = join(projectRoot, relativePath);
		if (!(await fileExists(configPath))) {
			continue;
		}

		try {
			const parsed = JSON.parse(await readFile(configPath, "utf-8"));
			const result = projectVerificationConfigSchema.safeParse(parsed);
			if (result.success && result.data.verification.commandChecks.length > 0) {
				return Object.freeze([...result.data.verification.commandChecks]);
			}
		} catch {
			// Ignore malformed project-local config and fall back to lower-precedence sources.
		}
	}

	return null;
}

function commandForPackageManager(packageManager: string, scriptName: string): string {
	switch (packageManager) {
		case "bun":
			return `bun run ${scriptName}`;
		case "pnpm":
			return `pnpm run ${scriptName}`;
		case "yarn":
			return `yarn ${scriptName}`;
		default:
			return `npm run ${scriptName}`;
	}
}

async function detectPackageManager(
	projectRoot: string,
	pkg: PackageJsonLike,
): Promise<string | null> {
	const declaredPackageManager = pkg.packageManager?.split("@")[0]?.trim();
	if (declaredPackageManager) {
		return declaredPackageManager;
	}

	for (const candidate of PACKAGE_MANAGER_LOCKFILES) {
		if (await fileExists(join(projectRoot, candidate.path))) {
			return candidate.name;
		}
	}

	return null;
}

export async function resolveVerificationCommands(
	projectRoot: string,
	config: PluginConfig | null = null,
): Promise<readonly VerificationCommand[]> {
	const projectCommands = await loadProjectVerificationCommands(projectRoot);
	if (projectCommands) {
		return projectCommands;
	}

	const configuredSettings = resolveProjectVerificationSettings(config, projectRoot);
	if (configuredSettings) {
		return Object.freeze([...configuredSettings.commandChecks]);
	}

	const packageJsonPath = join(projectRoot, "package.json");
	try {
		if (!(await fileExists(packageJsonPath))) {
			return createDefaultVerificationCommands();
		}

		const pkg = JSON.parse(await readFile(packageJsonPath, "utf-8")) as PackageJsonLike;
		const packageManager = (await detectPackageManager(projectRoot, pkg)) ?? "npm";
		return createDefaultVerificationCommands(packageManager);
	} catch {
		return createDefaultVerificationCommands();
	}
}

export class VerificationHandler {
	private readonly runCommand: ((command: string) => Promise<CommandExecutionResult>) | null;
	private readonly projectRoot: string;
	private commandChecksPromise: Promise<readonly VerificationCommand[]> | null = null;

	constructor(private readonly deps: VerificationHandlerDeps = {}) {
		this.projectRoot = deps.projectRoot ?? process.cwd();
		this.runCommand = deps.runCommand ?? createDefaultCommandRunnerForProject(this.projectRoot);
	}

	async verify(_context: LoopContext): Promise<VerificationResult> {
		const commandChecks = await this.getCommandChecks();
		const commandCheckResults =
			commandChecks.length > 0
				? await Promise.all(
						commandChecks.map((commandCheck) =>
							this.runCommandCheck(commandCheck.name, commandCheck.command),
						),
					)
				: [createCheck("verification", "BLOCKED", "No verification commands configured")];
		const checks = await Promise.all([
			...commandCheckResults,
			this.checkArtifactsExist(this.deps.artifactPaths ?? []),
		]);
		const status = determineVerificationStatus(checks);

		return Object.freeze({
			passed: status === "PASSED",
			status,
			checks: Object.freeze(checks),
			timestamp: new Date().toISOString(),
		});
	}

	async checkArtifactsExist(paths: readonly string[]): Promise<VerificationCheck> {
		if (paths.length === 0) {
			return createCheck("artifacts", "PASSED", "No artifact paths configured");
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
				return createCheck("artifacts", "FAILED", `Missing artifacts: ${missingPaths.join(", ")}`);
			}

			return createCheck("artifacts", "PASSED", `Verified ${paths.length} artifact(s)`);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return createCheck("artifacts", "FAILED", `Artifact check failed: ${message}`);
		}
	}

	private async getCommandChecks(): Promise<readonly VerificationCommand[]> {
		if (this.commandChecksPromise) {
			return this.commandChecksPromise;
		}

		this.commandChecksPromise = this.deps.commandChecks
			? Promise.resolve(Object.freeze([...this.deps.commandChecks]))
			: resolveVerificationCommands(this.projectRoot, this.deps.config ?? null);

		return this.commandChecksPromise;
	}

	private async runCommandCheck(name: string, command: string): Promise<VerificationCheck> {
		if (!this.runCommand) {
			return createCheck(name, "BLOCKED", `Failed ${command}: no command runner configured`);
		}

		try {
			const result = await this.runCommand(command);
			if (result.exitCode === 0) {
				return createCheck(name, "PASSED", `${command} passed`);
			}

			const details =
				result.output.trim().length > 0 ? `: ${result.output}` : ` (exit code ${result.exitCode})`;
			return createCheck(name, "FAILED", `${command} failed${details}`);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			return createCheck(name, "FAILED", `${command} failed: ${message}`);
		}
	}
}
