import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { copyIfMissing } from "./utils/fs-helpers";
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
		if (
			error instanceof Error &&
			"code" in error &&
			(error as NodeJS.ErrnoException).code === "ENOENT"
		) {
			return [];
		}
		throw error;
	}
}

async function processFiles(
	sourceDir: string,
	targetDir: string,
	category: string,
	copied: string[],
	skipped: string[],
	errors: string[],
): Promise<void> {
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
}

async function processSkills(
	sourceDir: string,
	targetDir: string,
	copied: string[],
	skipped: string[],
	errors: string[],
): Promise<void> {
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
}

export async function installAssets(
	assetsDir: string = getAssetsDir(),
	targetDir: string = getGlobalConfigDir(),
): Promise<InstallResult> {
	const copied: string[] = [];
	const skipped: string[] = [];
	const errors: string[] = [];

	await processFiles(assetsDir, targetDir, "agents", copied, skipped, errors);
	await processFiles(
		assetsDir,
		targetDir,
		"commands",
		copied,
		skipped,
		errors,
	);
	await processSkills(assetsDir, targetDir, copied, skipped, errors);

	return { copied, skipped, errors };
}
