/**
 * Log rotation and retention for the OpenCode Autopilot plugin.
 *
 * Handles:
 * - Max file-count enforcement (oldest files pruned first)
 * - Time-based expiry (files older than `maxAgeDays` are removed)
 * - Gzip compression of rotated `.log` / `.jsonl` files
 *
 * All filesystem operations use `node:fs/promises` for portability.
 *
 * @module
 */

import { createReadStream, createWriteStream } from "node:fs";
import { readdir, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { isEnoentError } from "../utils/fs-helpers";

/** Extensions eligible for gzip compression during rotation. */
const COMPRESSIBLE_EXTENSIONS = new Set([".log", ".jsonl"]);

/** Default maximum number of log files to keep (excluding compressed archives). */
const DEFAULT_MAX_FILES = 10;

/** Default maximum log file size in bytes (10 MiB). */
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** Default maximum age in days before a file is deleted. */
const DEFAULT_MAX_AGE_DAYS = 30;

export interface RotationOptions {
	/**
	 * Maximum number of log files to retain (oldest are pruned first).
	 * Does not count `.gz` archives.
	 * @default 10
	 */
	readonly maxFiles?: number;

	/**
	 * Maximum individual file size in bytes. Files exceeding this limit are
	 * compressed and renamed with a `.gz` extension before the next write.
	 * @default 10_485_760 (10 MiB)
	 */
	readonly maxSize?: number;

	/**
	 * Maximum age in days. Files (and archives) older than this are deleted.
	 * @default 30
	 */
	readonly maxAgeDays?: number;
}

export interface RotationResult {
	/** Number of files compressed into `.gz` archives. */
	readonly compressed: number;
	/** Number of files deleted (age or count limit exceeded). */
	readonly deleted: number;
}

interface FileEntry {
	readonly name: string;
	readonly path: string;
	readonly mtimeMs: number;
	readonly size: number;
}

function isCompressible(name: string): boolean {
	const dot = name.lastIndexOf(".");
	if (dot === -1) return false;
	const ext = name.slice(dot);
	return COMPRESSIBLE_EXTENSIONS.has(ext);
}

function isArchive(name: string): boolean {
	return name.endsWith(".gz");
}

/**
 * Compresses `sourcePath` to `sourcePath + ".gz"` then removes the original.
 * Returns `true` on success, `false` if the source vanished mid-flight.
 */
async function gzipFile(sourcePath: string): Promise<boolean> {
	const archivePath = `${sourcePath}.gz`;
	await new Promise<void>((resolve, reject) => {
		const readStream = createReadStream(sourcePath);
		const writeStream = createWriteStream(archivePath);
		const gzip = createGzip();

		readStream.on("error", reject);
		writeStream.on("error", reject);
		writeStream.on("finish", resolve);

		readStream.pipe(gzip).pipe(writeStream);
	});
	// Only remove the original after the archive is fully written.
	await unlink(sourcePath);
	return true;
}

/**
 * Reads all entries in `logDir`, resolving `stat` for each.
 * Silently skips entries that disappear between readdir and stat.
 */
async function listEntries(logDir: string): Promise<readonly FileEntry[]> {
	let names: string[];
	try {
		names = await readdir(logDir);
	} catch (error: unknown) {
		if (isEnoentError(error)) return [];
		throw error;
	}

	const entries: FileEntry[] = [];
	for (const name of names) {
		const filePath = join(logDir, name);
		try {
			const fileStat = await stat(filePath);
			if (!fileStat.isFile()) continue;
			entries.push({
				name,
				path: filePath,
				mtimeMs: fileStat.mtimeMs,
				size: fileStat.size,
			});
		} catch (error: unknown) {
			if (!isEnoentError(error)) throw error;
			// File disappeared between readdir and stat — skip it.
		}
	}

	return entries;
}

/**
 * Checks whether a single file exceeds the given `maxSize` threshold.
 *
 * Intended for use by writers that want to rotate before the next append.
 *
 * @param filePath - Absolute path to the log file.
 * @param maxSize  - Size limit in bytes.
 * @returns `true` when the file exists and its size exceeds `maxSize`.
 */
export async function exceedsMaxSize(filePath: string, maxSize: number): Promise<boolean> {
	try {
		const fileStat = await stat(filePath);
		return fileStat.isFile() && fileStat.size > maxSize;
	} catch (error: unknown) {
		if (isEnoentError(error)) return false;
		throw error;
	}
}

/**
 * Rotates a single active log file by compressing it to `<filePath>.gz`.
 *
 * The caller is responsible for opening a fresh log file afterwards.
 * Returns `true` when the file was successfully rotated, `false` when the
 * file did not exist (nothing to rotate).
 *
 * @param filePath - Absolute path to the log file to rotate.
 */
export async function rotateFile(filePath: string): Promise<boolean> {
	try {
		const fileStat = await stat(filePath);
		if (!fileStat.isFile()) return false;
	} catch (error: unknown) {
		if (isEnoentError(error)) return false;
		throw error;
	}

	if (!isCompressible(filePath)) {
		// Non-compressible files are renamed with a timestamp suffix.
		const rotatedPath = `${filePath}.${Date.now()}.bak`;
		await rename(filePath, rotatedPath);
		return true;
	}

	return gzipFile(filePath);
}

/**
 * Runs the full rotation and retention policy for all log files in `logDir`.
 *
 * **What this does (in order):**
 * 1. Compress oversized `.log` / `.jsonl` files into `.gz` archives.
 * 2. Delete files (any extension) older than `maxAgeDays`.
 * 3. Prune oldest plain log files when their count exceeds `maxFiles`.
 *
 * @param logDir  - Directory containing log files.
 * @param options - Rotation and retention options.
 * @returns Counts of compressed and deleted files.
 */
export async function rotateLogs(
	logDir: string,
	options?: RotationOptions,
): Promise<RotationResult> {
	const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
	const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE_BYTES;
	const maxAgeDays = options?.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
	const ageThresholdMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

	let compressed = 0;
	let deleted = 0;

	// --- Pass 1: Compress oversized plain log files ---
	{
		const entries = await listEntries(logDir);
		for (const entry of entries) {
			if (isArchive(entry.name)) continue;
			if (!isCompressible(entry.name)) continue;
			if (entry.size <= maxSize) continue;

			try {
				const rotated = await gzipFile(entry.path);
				if (rotated) compressed++;
			} catch (error: unknown) {
				if (!isEnoentError(error)) throw error;
				// File disappeared — not an error.
			}
		}
	}

	// --- Pass 2: Delete files older than maxAgeDays (any extension) ---
	{
		const entries = await listEntries(logDir);
		for (const entry of entries) {
			if (entry.mtimeMs >= ageThresholdMs) continue;

			try {
				await unlink(entry.path);
				deleted++;
			} catch (error: unknown) {
				if (!isEnoentError(error)) throw error;
			}
		}
	}

	// --- Pass 3: Prune oldest plain log files that exceed maxFiles count ---
	{
		const entries = await listEntries(logDir);
		const plainLogs = entries
			.filter((e) => !isArchive(e.name) && isCompressible(e.name))
			.sort((a, b) => a.mtimeMs - b.mtimeMs); // oldest first

		const overflow = plainLogs.length - maxFiles;
		if (overflow > 0) {
			const toDelete = plainLogs.slice(0, overflow);
			for (const entry of toDelete) {
				try {
					await unlink(entry.path);
					deleted++;
				} catch (error: unknown) {
					if (!isEnoentError(error)) throw error;
				}
			}
		}
	}

	return { compressed, deleted };
}
