import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { isEnoentError } from "../utils/fs-helpers";
import { getGlobalConfigDir } from "../utils/paths";

const DEFAULT_RETENTION_DAYS = 30;

interface PruneOptions {
	readonly logsDir?: string;
	readonly retentionDays?: number;
}

interface PruneResult {
	readonly pruned: number;
}

/**
 * Removes log files older than the configured retention period.
 * Defaults to 30 days if no retention period is specified (D-12).
 *
 * Runs non-blocking on plugin load (D-14).
 * Handles missing or empty directories gracefully.
 *
 * @param options - Optional logs directory and retention period
 * @returns Count of pruned files
 */
export async function pruneOldLogs(options?: PruneOptions): Promise<PruneResult> {
	const logsDir = options?.logsDir ?? join(getGlobalConfigDir(), "projects");
	const retentionDays = options?.retentionDays ?? DEFAULT_RETENTION_DAYS;
	const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

	let entries: string[];
	try {
		entries = await readdir(logsDir);
	} catch (error: unknown) {
		if (isEnoentError(error)) return { pruned: 0 };
		throw error;
	}

	let pruned = 0;

	for (const entry of entries) {
		const filePath = join(logsDir, entry);
		try {
			const fileStat = await stat(filePath);
			if (fileStat.isFile() && fileStat.mtimeMs < threshold) {
				await unlink(filePath);
				pruned++;
			}
		} catch (error: unknown) {
			// Skip files that disappear between readdir and stat (race condition safety)
			if (!isEnoentError(error)) throw error;
		}
	}

	return { pruned };
}
