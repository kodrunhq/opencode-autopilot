import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isEnoentError } from "./fs-helpers";

const GITIGNORE_ENTRY = ".opencode-assets/";

export async function ensureGitignore(projectRoot: string): Promise<void> {
	const gitignorePath = join(projectRoot, ".gitignore");

	let content: string;
	try {
		content = await readFile(gitignorePath, "utf-8");
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			await writeFile(gitignorePath, `${GITIGNORE_ENTRY}\n`, "utf-8");
			return;
		}
		throw error;
	}

	if (content.includes(GITIGNORE_ENTRY)) {
		return;
	}

	const suffix = content.endsWith("\n") ? "" : "\n";
	await writeFile(gitignorePath, `${content}${suffix}${GITIGNORE_ENTRY}\n`, "utf-8");
}
