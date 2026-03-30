import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";

export function isEnoentError(
	error: unknown,
): error is NodeJS.ErrnoException {
	return (
		error instanceof Error &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === "ENOENT"
	);
}

export async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function ensureDir(dirPath: string): Promise<void> {
	await mkdir(dirPath, { recursive: true });
}

export async function copyIfMissing(
	source: string,
	target: string,
): Promise<{ copied: boolean }> {
	await ensureDir(dirname(target));
	try {
		await copyFile(source, target, constants.COPYFILE_EXCL);
		return { copied: true };
	} catch (error: unknown) {
		if (
			error instanceof Error &&
			"code" in error &&
			(error as NodeJS.ErrnoException).code === "EEXIST"
		) {
			return { copied: false };
		}
		throw error;
	}
}
