import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileExists } from "./fs-helpers";

export function parseJsonc(content: string): unknown {
	let result = "";
	let i = 0;
	let inString = false;
	let escapeNext = false;
	// Track pending comma position to handle trailing commas
	let pendingCommaPos = -1;

	while (i < content.length) {
		const char = content[i];
		const nextChar = content[i + 1];

		// Handle escape sequences
		if (escapeNext) {
			result += char;
			escapeNext = false;
			pendingCommaPos = -1;
			i++;
			continue;
		}

		if (char === "\\" && inString) {
			result += char;
			escapeNext = true;
			pendingCommaPos = -1;
			i++;
			continue;
		}

		// Handle string boundaries
		if (char === '"' && !inString) {
			// If entering a string and we have a pending comma, add it first
			if (pendingCommaPos >= 0) {
				result = `${result.slice(0, pendingCommaPos)},${result.slice(pendingCommaPos)}`;
				pendingCommaPos = -1;
			}
			inString = true;
			result += char;
			i++;
			continue;
		}

		if (char === '"' && inString) {
			inString = false;
			result += char;
			pendingCommaPos = -1;
			i++;
			continue;
		}

		// Inside strings: copy everything as-is
		if (inString) {
			result += char;
			pendingCommaPos = -1;
			i++;
			continue;
		}

		// Outside strings: handle comments, trailing commas, and normal characters

		// Single-line comment
		if (char === "/" && nextChar === "/") {
			while (i < content.length && content[i] !== "\n") {
				i++;
			}
			continue;
		}

		// Multi-line comment
		if (char === "/" && nextChar === "*") {
			i += 2;
			while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) {
				i++;
			}
			i += 2;
			continue;
		}

		// Track commas but don't add them yet (to handle trailing commas)
		if (char === ",") {
			pendingCommaPos = result.length;
			i++;
			continue;
		}

		// Whitespace: preserve but keep tracking comma
		if (/\s/.test(char)) {
			result += char;
			i++;
			continue;
		}

		// Closing brace/bracket: skip any pending comma (trailing comma)
		if (char === "}" || char === "]") {
			pendingCommaPos = -1;
			result += char;
			i++;
			continue;
		}

		// Any other character: add pending comma if exists, then add character
		if (pendingCommaPos >= 0) {
			result = `${result.slice(0, pendingCommaPos)},${result.slice(pendingCommaPos)}`;
			pendingCommaPos = -1;
		}
		result += char;
		i++;
	}

	return JSON.parse(result);
}

async function findGitRoot(startDir: string): Promise<string | null> {
	let current = resolve(startDir);
	const visited = new Set<string>();

	while (!visited.has(current)) {
		visited.add(current);

		const gitDir = join(current, ".git");
		if (await fileExists(gitDir)) {
			return current;
		}

		const parent = dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
	}

	return null;
}

async function findProjectConfig(cwd: string): Promise<string | null> {
	const gitRoot = await findGitRoot(cwd);
	const stopAt = gitRoot ?? "/";

	let current = resolve(cwd);
	const visited = new Set<string>();

	while (!visited.has(current)) {
		visited.add(current);

		const jsonPath = join(current, ".opencode.json");
		if (await fileExists(jsonPath)) {
			return jsonPath;
		}

		const jsoncPath = join(current, ".opencode.jsonc");
		if (await fileExists(jsoncPath)) {
			return jsoncPath;
		}

		const legacyJsonPath = join(current, "opencode.json");
		if (await fileExists(legacyJsonPath)) {
			return legacyJsonPath;
		}

		const legacyJsoncPath = join(current, "opencode.jsonc");
		if (await fileExists(legacyJsoncPath)) {
			return legacyJsoncPath;
		}

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

function getGlobalConfigPath(): string {
	return join(homedir(), ".config", "opencode", ".opencode.json");
}

export interface ResolvedConfig {
	readonly path: string;
	readonly exists: boolean;
	readonly content: Record<string, unknown> | null;
	readonly location: "env-exact" | "env-dir" | "project" | "global";
}

export interface ResolveOptions {
	readonly cwd?: string;
}

export async function resolveOpenCodeConfig(options: ResolveOptions = {}): Promise<ResolvedConfig> {
	const cwd = options.cwd ?? process.cwd();

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

	const envConfigDir = process.env.OPENCODE_CONFIG_DIR;
	if (envConfigDir) {
		const dir = resolve(envConfigDir);

		for (const filename of [
			".opencode.json",
			".opencode.jsonc",
			"opencode.json",
			"opencode.jsonc",
		]) {
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
					return {
						path: configPath,
						exists: true,
						content: null,
						location: "env-dir",
					};
				}
			}
		}

		return {
			path: join(dir, ".opencode.json"),
			exists: false,
			content: null,
			location: "env-dir",
		};
	}

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
			return {
				path: projectConfig,
				exists: true,
				content: null,
				location: "project",
			};
		}
	}

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
		return join(gitRoot, ".opencode.json");
	}
	return getGlobalConfigPath();
}

export interface PluginVerificationResult {
	readonly success: boolean;
	readonly message: string;
	readonly details?: string;
}

export async function verifyPluginLoad(): Promise<PluginVerificationResult> {
	try {
		execSync("opencode --version", {
			encoding: "utf-8",
			timeout: 10000,
			stdio: ["pipe", "pipe", "pipe"],
		});

		return {
			success: true,
			message: "OpenCode CLI accessible",
			details: "CLI responds to commands (plugin load not verified)",
		};
	} catch (error: unknown) {
		const err = error as Error & { stderr?: string; status?: number };

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
