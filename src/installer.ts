import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { copyIfMissing, isEnoentError } from "./utils/fs-helpers";
import { getAssetsDir, getGlobalConfigDir } from "./utils/paths";

/**
 * Assets that were previously shipped but have since been removed from the source repo.
 * These are cleaned up from the target directory on every install to avoid stale files.
 */
const DEPRECATED_ASSETS = ["agents/placeholder-agent.md", "commands/configure.md"] as const;

export interface InstallResult {
	readonly copied: readonly string[];
	readonly skipped: readonly string[];
	readonly errors: readonly string[];
}

interface ListEntriesResult {
	readonly entries: ReadonlyArray<{ name: string; isDirectory: boolean }>;
	readonly error: string | null;
}

async function listEntries(dirPath: string): Promise<ListEntriesResult> {
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		return {
			entries: entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() })),
			error: null,
		};
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return { entries: [], error: null };
		}
		const message = error instanceof Error ? error.message : String(error);
		return { entries: [], error: `${dirPath}: ${message}` };
	}
}

async function processFiles(
	sourceDir: string,
	targetDir: string,
	category: string,
): Promise<InstallResult> {
	const copied: string[] = [];
	const skipped: string[] = [];
	const errors: string[] = [];

	const listing = await listEntries(join(sourceDir, category));
	if (listing.error) {
		errors.push(listing.error);
	}

	for (const entry of listing.entries) {
		if (entry.name === ".gitkeep") continue;
		if (entry.isDirectory) continue;

		const relativePath = `${category}/${entry.name}`;
		const source = join(sourceDir, relativePath);
		const target = join(targetDir, relativePath);

		try {
			const result = await copyIfMissing(source, target);
			if (result.copied) {
				copied.push(relativePath);
			} else {
				skipped.push(relativePath);
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			errors.push(`${relativePath}: ${message}`);
		}
	}

	return { copied, skipped, errors };
}

async function processSkills(sourceDir: string, targetDir: string): Promise<InstallResult> {
	const copied: string[] = [];
	const skipped: string[] = [];
	const errors: string[] = [];

	const skillListing = await listEntries(join(sourceDir, "skills"));
	if (skillListing.error) {
		errors.push(skillListing.error);
	}

	for (const dir of skillListing.entries) {
		if (!dir.isDirectory) continue;
		if (dir.name === ".gitkeep") continue;

		const fileListing = await listEntries(join(sourceDir, "skills", dir.name));
		if (fileListing.error) {
			errors.push(fileListing.error);
		}

		for (const file of fileListing.entries) {
			if (file.name === ".gitkeep") continue;
			if (file.isDirectory) continue;

			const relativePath = `skills/${dir.name}/${file.name}`;
			const source = join(sourceDir, relativePath);
			const target = join(targetDir, relativePath);

			try {
				const result = await copyIfMissing(source, target);
				if (result.copied) {
					copied.push(relativePath);
				} else {
					skipped.push(relativePath);
				}
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(`${relativePath}: ${message}`);
			}
		}
	}

	return { copied, skipped, errors };
}

async function cleanupDeprecatedAssets(targetDir: string): Promise<readonly string[]> {
	const removed: string[] = [];
	for (const asset of DEPRECATED_ASSETS) {
		try {
			await unlink(join(targetDir, asset));
			removed.push(asset);
		} catch (error: unknown) {
			if (!isEnoentError(error)) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(
					`[opencode-autopilot] Failed to remove deprecated asset ${asset}: ${message}`,
				);
			}
			// ENOENT is expected — asset already gone
		}
	}
	return removed;
}

export async function installAssets(
	assetsDir: string = getAssetsDir(),
	targetDir: string = getGlobalConfigDir(),
): Promise<InstallResult> {
	// Remove deprecated assets before copying new ones
	await cleanupDeprecatedAssets(targetDir);

	const [agents, commands, skills] = await Promise.all([
		processFiles(assetsDir, targetDir, "agents"),
		processFiles(assetsDir, targetDir, "commands"),
		processSkills(assetsDir, targetDir),
	]);

	return {
		copied: [...agents.copied, ...commands.copied, ...skills.copied],
		skipped: [...agents.skipped, ...commands.skipped, ...skills.skipped],
		errors: [...agents.errors, ...commands.errors, ...skills.errors],
	};
}
