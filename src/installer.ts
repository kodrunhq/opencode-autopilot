import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { copyIfMissing, isEnoentError } from "./utils/fs-helpers";
import { getAssetsDir, getGlobalConfigDir } from "./utils/paths";

export interface InstallResult {
	readonly copied: readonly string[];
	readonly skipped: readonly string[];
	readonly errors: readonly string[];
}

async function listEntries(
	dirPath: string,
): Promise<ReadonlyArray<{ name: string; isDirectory: boolean }>> {
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return [];
		}
		throw error;
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

	const entries = await listEntries(join(sourceDir, category));

	for (const entry of entries) {
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
			const message =
				error instanceof Error ? error.message : String(error);
			errors.push(`${relativePath}: ${message}`);
		}
	}

	return { copied, skipped, errors };
}

async function processSkills(
	sourceDir: string,
	targetDir: string,
): Promise<InstallResult> {
	const copied: string[] = [];
	const skipped: string[] = [];
	const errors: string[] = [];

	const skillDirs = await listEntries(join(sourceDir, "skills"));

	for (const dir of skillDirs) {
		if (!dir.isDirectory) continue;
		if (dir.name === ".gitkeep") continue;

		const files = await listEntries(join(sourceDir, "skills", dir.name));

		for (const file of files) {
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
				const message =
					error instanceof Error ? error.message : String(error);
				errors.push(`${relativePath}: ${message}`);
			}
		}
	}

	return { copied, skipped, errors };
}

export async function installAssets(
	assetsDir: string = getAssetsDir(),
	targetDir: string = getGlobalConfigDir(),
): Promise<InstallResult> {
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
