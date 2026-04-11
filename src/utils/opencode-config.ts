/**
 * OpenCode configuration resolver
 *
 * Implements OpenCode's config resolution logic:
 * 1. OPENCODE_CONFIG env var (exact file path)
 * 2. OPENCODE_CONFIG_DIR env var (directory containing opencode.json)
 * 3. Project config: nearest opencode.json (upward from cwd to git root)
 * 4. Global config: ~/.config/opencode/opencode.json
 *
 * Supports both JSON and JSONC (JSON with comments) formats.
 */

import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileExists } from "./fs-helpers";

/** Strip JSONC comments to parse as JSON */
function stripJsonComments(jsonc: string): string {
	let result = jsonc.replace(/(^|\s)\/\/.*$/gm, "$1");
	result = result.replace(/\/\*[\s\S]*?\*\//g, "");
	return result;
}

function stripTrailingCommas(json: string): string {
	return json.replace(/,(\s*[}\]])/g, "$1");
}

export function parseJsonc(content: string): unknown {
	const withoutComments = stripJsonComments(content);
	const withoutTrailingCommas = stripTrailingCommas(withoutComments);
	return JSON.parse(withoutTrailingCommas);
}

async function findGitRoot(startDir: string): Promise<string | null> {
	let current = resolve(startDir);
	const visited = new Set<string>();

	while (!visited.has(current)) {
		visited.add(current);

		// Check for .git directory
		const gitDir = join(current, ".git");
		if (await fileExists(gitDir)) {
			return current;
		}

		const parent = dirname(current);
		if (parent === current) {
			// Reached filesystem root
			break;
		}
		current = parent;
	}

	return null;
}

/** Find project config by walking up from cwd to git root */
async function findProjectConfig(cwd: string): Promise<string | null> {
	const gitRoot = await findGitRoot(cwd);
	const stopAt = gitRoot ?? "/";

	let current = resolve(cwd);
	const visited = new Set<string>();

	while (!visited.has(current)) {
		visited.add(current);

		// Check for opencode.json first
		const jsonPath = join(current, "opencode.json");
		if (await fileExists(jsonPath)) {
			return jsonPath;
		}

		// Check for opencode.jsonc
		const jsoncPath = join(current, "opencode.jsonc");
		if (await fileExists(jsoncPath)) {
			return jsoncPath;
		}

		// Stop at git root or filesystem root
		if (current === stopAt || current === "/") {
			break;
		}

		const parent = dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
	}

	return null;
}

/** Get global config path */
function getGlobalConfigPath(): string {
	return join(homedir(), ".config", "opencode", "opencode.json");
}

/** Result of config resolution */
export interface ResolvedConfig {
	/** Path to the config file that was found/should be used */
	readonly path: string;
	/** Whether the config file exists */
	readonly exists: boolean;
	/** Parsed config content (null if doesn't exist or parse error) */
	readonly content: Record<string, unknown> | null;
	/** Type of config location */
	readonly location: "env-exact" | "env-dir" | "project" | "global";
}

/** Options for resolving OpenCode config */
export interface ResolveOptions {
	/** Starting directory for project config search (defaults to process.cwd()) */
	readonly cwd?: string;
	/** Whether to create the config directory if it doesn't exist */
	readonly ensureDir?: boolean;
}

/**
 * Resolve OpenCode config location according to OpenCode's rules.
 *
 * Resolution order:
 * 1. OPENCODE_CONFIG env var - exact file path
 * 2. OPENCODE_CONFIG_DIR env var - directory containing opencode.json
 * 3. Project config - nearest opencode.json/c (up from cwd to git root)
 * 4. Global config - ~/.config/opencode/opencode.json
 *
 * For modification, use the returned path. The location field indicates
 * which resolution rule matched.
 */
export async function resolveOpenCodeConfig(options: ResolveOptions = {}): Promise<ResolvedConfig> {
	const cwd = options.cwd ?? process.cwd();

	// 1. Check OPENCODE_CONFIG env var (exact file path)
	const envConfigPath = process.env.OPENCODE_CONFIG;
	if (envConfigPath) {
		const resolvedPath = resolve(envConfigPath);
		const exists = await fileExists(resolvedPath);
		let content: Record<string, unknown> | null = null;

		if (exists) {
			try {
				const raw = await readFile(resolvedPath, "utf-8");
				content = parseJsonc(raw) as Record<string, unknown>;
			} catch {
				// Parse error - will be handled by caller
			}
		}

		return {
			path: resolvedPath,
			exists,
			content,
			location: "env-exact",
		};
	}

	// 2. Check OPENCODE_CONFIG_DIR env var
	const envConfigDir = process.env.OPENCODE_CONFIG_DIR;
	if (envConfigDir) {
		const dir = resolve(envConfigDir);

		// Try opencode.json first, then opencode.jsonc
		for (const filename of ["opencode.json", "opencode.jsonc"]) {
			const configPath = join(dir, filename);
			if (await fileExists(configPath)) {
				try {
					const raw = await readFile(configPath, "utf-8");
					const content = parseJsonc(raw) as Record<string, unknown>;
					return {
						path: configPath,
						exists: true,
						content,
						location: "env-dir",
					};
				} catch {
					// Parse error - return path anyway for modification
					return {
						path: configPath,
						exists: true,
						content: null,
						location: "env-dir",
					};
				}
			}
		}

		// Config dir specified but no config file - use opencode.json in that dir
		return {
			path: join(dir, "opencode.json"),
			exists: false,
			content: null,
			location: "env-dir",
		};
	}

	// 3. Find project config (walk up from cwd to git root)
	const projectConfig = await findProjectConfig(cwd);
	if (projectConfig) {
		try {
			const raw = await readFile(projectConfig, "utf-8");
			const content = parseJsonc(raw) as Record<string, unknown>;
			return {
				path: projectConfig,
				exists: true,
				content,
				location: "project",
			};
		} catch {
			// Parse error
			return {
				path: projectConfig,
				exists: true,
				content: null,
				location: "project",
			};
		}
	}

	// 4. Fall back to global config
	const globalPath = getGlobalConfigPath();
	const exists = await fileExists(globalPath);
	let content: Record<string, unknown> | null = null;

	if (exists) {
		try {
			const raw = await readFile(globalPath, "utf-8");
			content = parseJsonc(raw) as Record<string, unknown>;
		} catch {
			// Parse error
		}
	}

	return {
		path: globalPath,
		exists,
		content,
		location: "global",
	};
}

export async function getInstallTargetPath(cwd?: string): Promise<string> {
	const resolvedCwd = cwd ?? process.cwd();
	const gitRoot = await findGitRoot(resolvedCwd);
	if (gitRoot) {
		return join(gitRoot, "opencode.json");
	}
	return getGlobalConfigPath();
}

/** Result of plugin load verification */
export interface PluginVerificationResult {
	readonly success: boolean;
	readonly message: string;
	readonly details?: string;
}

/**
 * Verify that OpenCode can actually load the plugin.
 *
 * This spawns opencode with the plugin and checks if it loads successfully.
 * It's the only way to truly verify plugin health.
 */
export async function verifyPluginLoad(): Promise<PluginVerificationResult> {
	try {
		// Try to run opencode with a version check
		// If the plugin fails to load, opencode will report it
		const result = execSync("opencode --version", {
			encoding: "utf-8",
			timeout: 10000,
			stdio: ["pipe", "pipe", "pipe"],
		});

		return {
			success: true,
			message: "OpenCode CLI is accessible",
			details: result.trim(),
		};
	} catch (error: unknown) {
		const err = error as Error & { stderr?: string; status?: number };

		// Check stderr for plugin load errors
		if (err.stderr?.includes("failed to load plugin")) {
			return {
				success: false,
				message: "Plugin failed to load in OpenCode",
				details: err.stderr,
			};
		}

		if (err.stderr?.includes("Cannot find package")) {
			return {
				success: false,
				message: "Missing dependency - plugin package incomplete",
				details: err.stderr,
			};
		}

		if (err.status === 127 || err.message?.includes("ENOENT")) {
			return {
				success: false,
				message: "OpenCode CLI not found on PATH",
				details: "Install OpenCode from https://opencode.ai",
			};
		}

		return {
			success: false,
			message: "OpenCode verification failed",
			details: err.stderr || err.message,
		};
	}
}
