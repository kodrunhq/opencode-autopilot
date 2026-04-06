import { homedir } from "node:os";
import { join } from "node:path";
import { getGlobalConfigDir } from "../utils/paths";

export function getLspServerAdditionalPathBases(workingDirectory: string): readonly string[] {
	const configDir = getGlobalConfigDir();
	const dataDir = join(homedir(), ".local", "share", "opencode");
	return [
		join(workingDirectory, "node_modules", ".bin"),
		join(configDir, "bin"),
		join(configDir, "node_modules", ".bin"),
		join(dataDir, "bin"),
		join(dataDir, "bin", "node_modules", ".bin"),
	];
}
