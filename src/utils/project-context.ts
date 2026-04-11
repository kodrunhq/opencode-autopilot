import { getProjectArtifactDir } from "./paths";

export interface ProjectContext {
	projectRoot: string;
	sessionDirectory: string;
	artifactDir: string;
}

export function resolveProjectContext(context: {
	directory?: string;
	worktree?: string;
}): ProjectContext {
	const projectRoot = context.worktree ?? context.directory ?? process.cwd();
	const sessionDirectory = context.directory ?? projectRoot;
	const artifactDir = getProjectArtifactDir(projectRoot);

	return {
		projectRoot,
		sessionDirectory,
		artifactDir,
	};
}

export function getCanonicalProjectRoot(context: {
	directory?: string;
	worktree?: string;
}): string {
	return context.worktree ?? context.directory ?? process.cwd();
}
