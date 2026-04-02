import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { lintAgent, lintCommand, lintSkill } from "../skills/linter";
import { getAssetsDir, getGlobalConfigDir } from "../utils/paths";

interface StocktakeArgs {
	readonly lint?: boolean;
}

interface AssetEntry {
	readonly name: string;
	readonly type: "skill" | "command" | "agent";
	readonly origin: "built-in" | "user-created";
	readonly lint?: {
		readonly valid: boolean;
		readonly errors: readonly string[];
		readonly warnings: readonly string[];
	};
}

/** Read directory entries safely, returning empty array on ENOENT only. */
async function safeReaddir(dirPath: string): Promise<string[]> {
	try {
		return await readdir(dirPath);
	} catch (error: unknown) {
		const errObj = error as { code?: unknown };
		if (errObj?.code === "ENOENT") return [];
		throw error;
	}
}

/** Cache for built-in asset lookups (keyed by assetType). */
const builtInCache = new Map<string, ReadonlySet<string>>();

/** Check if an asset name exists in the bundled assets directory. */
async function isBuiltIn(assetType: string, name: string): Promise<boolean> {
	let cached = builtInCache.get(assetType);
	if (!cached) {
		const assetsDir = getAssetsDir();
		const entries = await safeReaddir(join(assetsDir, assetType));
		cached = new Set(entries);
		builtInCache.set(assetType, cached);
	}
	return cached.has(name);
}

export async function stocktakeCore(args: StocktakeArgs, baseDir: string): Promise<string> {
	const shouldLint = args.lint !== false;
	const skills: AssetEntry[] = [];
	const commands: AssetEntry[] = [];
	const agents: AssetEntry[] = [];

	// Scan skills (each subdirectory is a skill) — filter to directories only
	const skillEntries = await readdir(join(baseDir, "skills"), { withFileTypes: true }).catch(
		() => [],
	);
	const skillDirs = skillEntries
		.filter((e) => e.isDirectory() && e.name !== ".gitkeep")
		.map((e) => e.name);
	for (const name of skillDirs) {
		const skillFile = join(baseDir, "skills", name, "SKILL.md");
		const origin = (await isBuiltIn("skills", name)) ? "built-in" : "user-created";
		const entry: AssetEntry = { name, type: "skill", origin };

		if (shouldLint) {
			try {
				const content = await readFile(skillFile, "utf-8");
				const lint = lintSkill(content);
				skills.push({ ...entry, lint });
			} catch {
				skills.push({
					...entry,
					lint: { valid: false, errors: ["Could not read SKILL.md"], warnings: [] },
				});
			}
		} else {
			skills.push(entry);
		}
	}

	// Scan commands (.md files)
	const commandFiles = await safeReaddir(join(baseDir, "commands"));
	for (const file of commandFiles.filter((f) => f.endsWith(".md"))) {
		const name = file.replace(/\.md$/, "");
		const origin = (await isBuiltIn("commands", file)) ? "built-in" : "user-created";
		const entry: AssetEntry = { name, type: "command", origin };

		if (shouldLint) {
			try {
				const content = await readFile(join(baseDir, "commands", file), "utf-8");
				const lint = lintCommand(content);
				commands.push({ ...entry, lint });
			} catch {
				commands.push({
					...entry,
					lint: { valid: false, errors: ["Could not read command file"], warnings: [] },
				});
			}
		} else {
			commands.push(entry);
		}
	}

	// Scan agents (.md files)
	const agentFiles = await safeReaddir(join(baseDir, "agents"));
	for (const file of agentFiles.filter((f) => f.endsWith(".md"))) {
		const name = file.replace(/\.md$/, "");
		const origin = (await isBuiltIn("agents", file)) ? "built-in" : "user-created";
		const entry: AssetEntry = { name, type: "agent", origin };

		if (shouldLint) {
			try {
				const content = await readFile(join(baseDir, "agents", file), "utf-8");
				const lint = lintAgent(content);
				agents.push({ ...entry, lint });
			} catch {
				agents.push({
					...entry,
					lint: { valid: false, errors: ["Could not read agent file"], warnings: [] },
				});
			}
		} else {
			agents.push(entry);
		}
	}

	// Compute summary
	const allAssets = [...skills, ...commands, ...agents];
	const builtIn = allAssets.filter((a) => a.origin === "built-in").length;
	const userCreated = allAssets.filter((a) => a.origin === "user-created").length;
	const lintErrors = shouldLint
		? allAssets.reduce((sum, a) => sum + (a.lint?.errors.length ?? 0), 0)
		: 0;
	const lintWarnings = shouldLint
		? allAssets.reduce((sum, a) => sum + (a.lint?.warnings.length ?? 0), 0)
		: 0;

	return JSON.stringify(
		{
			skills,
			commands,
			agents,
			summary: {
				total: allAssets.length,
				builtIn,
				userCreated,
				lintErrors,
				lintWarnings,
			},
		},
		null,
		2,
	);
}

export const ocStocktake = tool({
	description:
		"Audit all installed skills, commands, and agents with optional YAML frontmatter lint validation.",
	args: {
		lint: tool.schema
			.boolean()
			.optional()
			.default(true)
			.describe("Run YAML frontmatter linter on all assets"),
	},
	async execute(args) {
		return stocktakeCore(args, getGlobalConfigDir());
	},
});
