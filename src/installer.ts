import { access, copyFile, open, readdir, readFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { copyIfMissing, ensureDir, isEnoentError } from "./utils/fs-helpers";
import { getAssetsDir, getGlobalConfigDir } from "./utils/paths";

/**
 * Assets that were previously shipped but have since been removed from the source repo.
 * These are cleaned up from the target directory on every install to avoid stale files.
 */
const DEPRECATED_ASSETS = [
	"agents/placeholder-agent.md",
	"agents/auth-flow-verifier.md",
	"agents/concurrency-checker.md",
	"agents/dead-code-scanner.md",
	"agents/go-idioms-auditor.md",
	"agents/python-django-auditor.md",
	"agents/react-patterns-auditor.md",
	"agents/rust-safety-auditor.md",
	"agents/scope-intent-verifier.md",
	"agents/silent-failure-hunter.md",
	"agents/spec-checker.md",
	"agents/state-mgmt-auditor.md",
	"agents/type-soundness.md",
	"agents/wiring-inspector.md",
	"commands/configure.md",
	"commands/oc-configure.md",
	"commands/brainstorm.md",
	"commands/new-agent.md",
	"commands/new-command.md",
	"commands/new-skill.md",
	"commands/quick.md",
	"commands/review-pr.md",
	"commands/stocktake.md",
	"commands/tdd.md",
	"commands/update-docs.md",
	"commands/write-plan.md",
] as const;

/**
 * Assets that must be overwritten on every install, even if the user has a copy.
 * Used when the shipped version has critical fixes that override user customizations.
 * Remove entries once the fix has been deployed long enough.
 */
const FORCE_UPDATE_ASSETS = [] as const;

export interface InstallResult {
	readonly copied: readonly string[];
	readonly skipped: readonly string[];
	readonly errors: readonly string[];
}

interface ListEntriesResult {
	readonly entries: ReadonlyArray<{ name: string; isDirectory: boolean }>;
	readonly error: string | null;
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return false;
		}
		throw error;
	}
}

async function listEntries(dirPath: string): Promise<ListEntriesResult> {
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		return {
			entries: entries.map((e) => ({
				name: e.name,
				isDirectory: e.isDirectory(),
			})),
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

async function haveSameContent(source: string, target: string): Promise<boolean> {
	const [sourceContent, targetContent] = await Promise.all([
		readFile(source, "utf-8"),
		readFile(target, "utf-8"),
	]);
	return sourceContent === targetContent;
}

async function syncAsset(
	source: string,
	target: string,
	options?: { readonly overwriteManaged?: boolean },
): Promise<{ readonly copied: boolean }> {
	if (!options?.overwriteManaged) {
		return copyIfMissing(source, target);
	}

	if (!(await pathExists(target))) {
		await ensureDir(dirname(target));
		await copyFile(source, target);
		return { copied: true };
	}

	if (await haveSameContent(source, target)) {
		return { copied: false };
	}

	if (!(await hasInstallerMarker(target))) {
		return { copied: false };
	}

	await ensureDir(dirname(target));
	await copyFile(source, target);
	return { copied: true };
}

async function processFiles(
	sourceDir: string,
	targetDir: string,
	category: string,
	options?: { readonly overwriteManaged?: boolean },
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
			const result = await syncAsset(source, target, options);
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

async function processSkills(
	sourceDir: string,
	targetDir: string,
	options?: { readonly overwriteManaged?: boolean },
): Promise<InstallResult> {
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
				const result = await syncAsset(source, target, options);
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

/** Marker string present in installer-generated file frontmatter. */
const INSTALLER_MARKER = "opencode-autopilot";

/** Read the first 200 bytes of a file to check for the installer marker. */
async function hasInstallerMarker(filePath: string): Promise<boolean> {
	let fh: import("node:fs/promises").FileHandle | undefined;
	try {
		fh = await open(filePath, "r");
		const buf = Buffer.alloc(200);
		const { bytesRead } = await fh.read(buf, 0, 200, 0);
		const head = buf.toString("utf-8", 0, bytesRead);
		return head.includes(INSTALLER_MARKER);
	} finally {
		try {
			await fh?.close();
		} catch {
			/* ignore close errors to avoid masking the primary exception */
		}
	}
}

async function cleanupDeprecatedAssets(targetDir: string): Promise<{
	readonly removed: readonly string[];
	readonly errors: readonly string[];
}> {
	const removed: string[] = [];
	const errors: string[] = [];
	for (const asset of DEPRECATED_ASSETS) {
		const filePath = join(targetDir, asset);
		try {
			// Only delete if the file contains the installer marker.
			// User-created files (without the marker) are left untouched.
			const isOurs = await hasInstallerMarker(filePath);
			if (!isOurs) continue;

			await unlink(filePath);
			removed.push(asset);
		} catch (error: unknown) {
			if (!isEnoentError(error)) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(`cleanup ${asset}: ${message}`);
			}
			// ENOENT is expected — asset already gone
		}
	}
	return { removed, errors };
}

async function forceUpdateAssets(
	sourceDir: string,
	targetDir: string,
): Promise<{
	readonly updated: readonly string[];
	readonly errors: readonly string[];
}> {
	const updated: string[] = [];
	const errors: string[] = [];
	for (const asset of FORCE_UPDATE_ASSETS) {
		const source = join(sourceDir, asset);
		const target = join(targetDir, asset);
		try {
			// Verify source exists before attempting copy — skip silently if
			// the source isn't in the bundle (test environments, partial installs)
			await access(source);
			await ensureDir(dirname(target));
			await copyFile(source, target);
			updated.push(asset);
		} catch (error: unknown) {
			if (!isEnoentError(error)) {
				const message = error instanceof Error ? error.message : String(error);
				errors.push(`force-update ${asset}: ${message}`);
			}
			// ENOENT = source not in bundle, skip silently
		}
	}
	return { updated, errors };
}

export async function installAssets(
	assetsDir: string = getAssetsDir(),
	targetDir: string = getGlobalConfigDir(),
): Promise<InstallResult> {
	// Remove deprecated assets before copying new ones
	const cleanup = await cleanupDeprecatedAssets(targetDir);

	// Force-overwrite assets with critical fixes
	const forceUpdate = await forceUpdateAssets(assetsDir, targetDir);

	const [agents, commands, skills, templates] = await Promise.all([
		processFiles(assetsDir, targetDir, "agents", { overwriteManaged: true }),
		processFiles(assetsDir, targetDir, "commands", { overwriteManaged: true }),
		processSkills(assetsDir, targetDir, { overwriteManaged: true }),
		processFiles(assetsDir, targetDir, "templates"),
	]);

	return {
		copied: [
			...forceUpdate.updated,
			...agents.copied,
			...commands.copied,
			...skills.copied,
			...templates.copied,
		],
		skipped: [...agents.skipped, ...commands.skipped, ...skills.skipped, ...templates.skipped],
		errors: [
			...cleanup.errors,
			...forceUpdate.errors,
			...agents.errors,
			...commands.errors,
			...skills.errors,
			...templates.errors,
		],
	};
}
