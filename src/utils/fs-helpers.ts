import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

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
	if (await fileExists(target)) {
		return { copied: false };
	}
	await ensureDir(dirname(target));
	await copyFile(source, target);
	return { copied: true };
}
