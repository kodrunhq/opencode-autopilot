import type { Database } from "bun:sqlite";
import { execFile as execFileCb, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { promisify } from "node:util";
import {
	getProjectByAnyPath,
	getProjectByCurrentPath,
	getProjectsByGitFingerprint,
	setProjectCurrentPath,
	upsertProjectGitFingerprint,
	upsertProjectRecord,
} from "./repository";
import { projectRecordSchema } from "./schemas";
import type { GitFingerprintInput, ProjectRecord } from "./types";

const execFile = promisify(execFileCb);

export interface ProjectResolverDeps {
	readonly db?: Database;
	readonly now?: () => string;
	readonly createProjectId?: () => string;
	readonly readGitFingerprint?: (projectRoot: string) => Promise<GitFingerprintInput | null>;
}

export function normalizeGitRemoteUrl(remoteUrl: string): string | null {
	const trimmed = remoteUrl.trim();
	if (trimmed.length === 0) {
		return null;
	}

	const scpMatch = trimmed.match(/^([^@\s]+)@([^:\s]+):(.+)$/);
	if (scpMatch) {
		const [, _user, host, path] = scpMatch;
		const normalizedPath = path.replace(/\.git$/i, "").replace(/^\/+/, "");
		return `${host.toLowerCase()}/${normalizedPath}`;
	}

	try {
		const parsed = new URL(trimmed);
		const normalizedPath = parsed.pathname.replace(/\.git$/i, "").replace(/^\/+/, "");
		if (normalizedPath.length === 0) {
			return null;
		}
		return `${parsed.host.toLowerCase()}/${normalizedPath}`;
	} catch {
		const normalized = trimmed.replace(/\.git$/i, "").replace(/^\/+/, "");
		return normalized.length > 0 ? normalized : null;
	}
}

async function readGitCommand(
	projectRoot: string,
	args: readonly string[],
): Promise<string | null> {
	try {
		const { stdout } = await execFile("git", args, {
			cwd: projectRoot,
			timeout: 5000,
		});
		const trimmed = stdout.trim();
		return trimmed.length > 0 ? trimmed : null;
	} catch {
		return null;
	}
}

function readGitCommandSync(projectRoot: string, args: readonly string[]): string | null {
	try {
		const stdout = execFileSync("git", args, {
			cwd: projectRoot,
			timeout: 5000,
			encoding: "utf-8",
		});
		const trimmed = stdout.trim();
		return trimmed.length > 0 ? trimmed : null;
	} catch {
		return null;
	}
}

export async function readProjectGitFingerprint(
	projectRoot: string,
): Promise<GitFingerprintInput | null> {
	const remoteUrl = await readGitCommand(projectRoot, ["config", "--get", "remote.origin.url"]);
	if (remoteUrl === null) {
		return null;
	}

	const normalizedRemoteUrl = normalizeGitRemoteUrl(remoteUrl);
	if (normalizedRemoteUrl === null) {
		return null;
	}

	const remoteHead = await readGitCommand(projectRoot, [
		"symbolic-ref",
		"--short",
		"refs/remotes/origin/HEAD",
	]);
	const defaultBranch =
		remoteHead === null ? null : remoteHead.split("/").slice(1).join("/") || null;

	return {
		normalizedRemoteUrl,
		defaultBranch,
	};
}

export function readProjectGitFingerprintSync(projectRoot: string): GitFingerprintInput | null {
	const remoteUrl = readGitCommandSync(projectRoot, ["config", "--get", "remote.origin.url"]);
	if (remoteUrl === null) {
		return null;
	}

	const normalizedRemoteUrl = normalizeGitRemoteUrl(remoteUrl);
	if (normalizedRemoteUrl === null) {
		return null;
	}

	const remoteHead = readGitCommandSync(projectRoot, [
		"symbolic-ref",
		"--short",
		"refs/remotes/origin/HEAD",
	]);
	const defaultBranch =
		remoteHead === null ? null : remoteHead.split("/").slice(1).join("/") || null;

	return {
		normalizedRemoteUrl,
		defaultBranch,
	};
}

export interface SyncProjectResolverDeps {
	readonly db?: Database;
	readonly now?: () => string;
	readonly createProjectId?: () => string;
	readonly readGitFingerprint?: (projectRoot: string) => GitFingerprintInput | null;
	readonly allowCreate?: boolean;
}

export async function resolveProjectIdentity(
	projectRoot: string,
	deps: ProjectResolverDeps = {},
): Promise<ProjectRecord> {
	const now = deps.now ?? (() => new Date().toISOString());
	const createProjectId = deps.createProjectId ?? (() => randomUUID());
	const readGitFingerprint = deps.readGitFingerprint ?? readProjectGitFingerprint;
	const seenAt = now();
	const projectName = basename(projectRoot);

	const current = getProjectByCurrentPath(projectRoot, deps.db);
	if (current !== null) {
		const updated = upsertProjectRecord(
			{
				...current,
				name: projectName,
				lastUpdated: seenAt,
			},
			deps.db,
		);
		const fingerprint = await readGitFingerprint(projectRoot);
		if (fingerprint !== null) {
			upsertProjectGitFingerprint(updated.id, fingerprint, seenAt, deps.db);
		}
		return updated;
	}

	const historical = getProjectByAnyPath(projectRoot, deps.db);
	if (historical !== null) {
		const updated = setProjectCurrentPath(historical.id, projectRoot, projectName, seenAt, deps.db);
		const fingerprint = await readGitFingerprint(projectRoot);
		if (fingerprint !== null) {
			upsertProjectGitFingerprint(updated.id, fingerprint, seenAt, deps.db);
		}
		return updated;
	}

	const fingerprint = await readGitFingerprint(projectRoot);
	if (fingerprint !== null) {
		const matches = getProjectsByGitFingerprint(fingerprint.normalizedRemoteUrl, deps.db);
		if (matches.length === 1) {
			const updated = setProjectCurrentPath(
				matches[0].id,
				projectRoot,
				projectName,
				seenAt,
				deps.db,
			);
			upsertProjectGitFingerprint(updated.id, fingerprint, seenAt, deps.db);
			return updated;
		}
	}

	const created = upsertProjectRecord(
		{
			id: createProjectId(),
			path: projectRoot,
			name: projectName,
			firstSeenAt: seenAt,
			lastUpdated: seenAt,
		},
		deps.db,
	);
	if (fingerprint !== null) {
		upsertProjectGitFingerprint(created.id, fingerprint, seenAt, deps.db);
	}
	return created;
}

export function resolveProjectIdentitySync(
	projectRoot: string,
	deps: SyncProjectResolverDeps = {},
): ProjectRecord {
	const now = deps.now ?? (() => new Date().toISOString());
	const createProjectId = deps.createProjectId ?? (() => randomUUID());
	const readGitFingerprint = deps.readGitFingerprint ?? readProjectGitFingerprintSync;
	const allowCreate = deps.allowCreate ?? true;
	const seenAt = now();
	const projectName = basename(projectRoot);

	const current = getProjectByCurrentPath(projectRoot, deps.db);
	if (current !== null) {
		if (!allowCreate) {
			return current;
		}

		const updated = upsertProjectRecord(
			{
				...current,
				name: projectName,
				lastUpdated: seenAt,
			},
			deps.db,
		);
		const fingerprint = readGitFingerprint(projectRoot);
		if (fingerprint !== null) {
			upsertProjectGitFingerprint(updated.id, fingerprint, seenAt, deps.db);
		}
		return updated;
	}

	const historical = getProjectByAnyPath(projectRoot, deps.db);
	if (historical !== null) {
		if (!allowCreate) {
			return historical;
		}

		const updated = setProjectCurrentPath(historical.id, projectRoot, projectName, seenAt, deps.db);
		const fingerprint = readGitFingerprint(projectRoot);
		if (fingerprint !== null) {
			upsertProjectGitFingerprint(updated.id, fingerprint, seenAt, deps.db);
		}
		return updated;
	}

	const fingerprint = readGitFingerprint(projectRoot);
	if (fingerprint !== null) {
		const matches = getProjectsByGitFingerprint(fingerprint.normalizedRemoteUrl, deps.db);
		if (matches.length === 1) {
			if (!allowCreate) {
				return matches[0];
			}

			const updated = setProjectCurrentPath(
				matches[0].id,
				projectRoot,
				projectName,
				seenAt,
				deps.db,
			);
			upsertProjectGitFingerprint(updated.id, fingerprint, seenAt, deps.db);
			return updated;
		}
	}

	if (!allowCreate) {
		return projectRecordSchema.parse({
			id: `project:${projectRoot}`,
			path: projectRoot,
			name: projectName,
			firstSeenAt: seenAt,
			lastUpdated: seenAt,
		});
	}

	const created = upsertProjectRecord(
		{
			id: createProjectId(),
			path: projectRoot,
			name: projectName,
			firstSeenAt: seenAt,
			lastUpdated: seenAt,
		},
		deps.db,
	);
	if (fingerprint !== null) {
		upsertProjectGitFingerprint(created.id, fingerprint, seenAt, deps.db);
	}
	return created;
}
