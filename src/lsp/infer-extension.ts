import { lstatSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { EXT_TO_LANG } from "./language-mappings";

const skippedDirectories = new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);
const maxScanEntries = 500;

export function inferExtensionFromDirectory(directory: string): string | null {
	const extensionCounts = new Map<string, number>();
	let scanned = 0;
	const walk = (currentDirectory: string): void => {
		if (scanned >= maxScanEntries) return;
		let entries: readonly string[] = [];
		try {
			entries = readdirSync(currentDirectory);
		} catch {
			return;
		}
		for (const entry of entries) {
			if (scanned >= maxScanEntries) return;
			const fullPath = join(currentDirectory, entry);
			try {
				const stats = lstatSync(fullPath);
				if (stats.isSymbolicLink()) continue;
				scanned += 1;
				if (stats.isDirectory()) {
					if (!skippedDirectories.has(entry)) walk(fullPath);
				} else if (stats.isFile()) {
					const extension = extname(fullPath);
					if (extension && extension in EXT_TO_LANG)
						extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);
				}
			} catch {}
		}
	};
	walk(directory);
	let winningExtension: string | null = null;
	let winningCount = 0;
	for (const [extension, count] of extensionCounts) {
		if (count > winningCount) {
			winningExtension = extension;
			winningCount = count;
		}
	}
	return winningExtension;
}
