import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { getLspServerAdditionalPathBases } from "./server-path-bases";

export function isServerInstalled(command: readonly string[]): boolean {
	const executable = command[0];
	if (!executable) return false;
	if ((executable.includes("/") || executable.includes("\\")) && existsSync(executable))
		return true;

	const isWindows = process.platform === "win32";
	const extensions = isWindows
		? Array.from(
				new Set([
					"",
					...(process.env.PATHEXT?.split(";").filter(Boolean) ?? []),
					".exe",
					".cmd",
					".bat",
					".ps1",
				]),
			)
		: [""];
	const pathValue = isWindows
		? (process.env.PATH ?? process.env.Path ?? "")
		: (process.env.PATH ?? "");
	const searchPaths = [
		...pathValue.split(delimiter),
		...getLspServerAdditionalPathBases(process.cwd()),
	];

	for (const base of searchPaths) {
		for (const suffix of extensions) {
			if (base && existsSync(join(base, `${executable}${suffix}`))) return true;
		}
	}

	return executable === "bun" || executable === "node";
}
