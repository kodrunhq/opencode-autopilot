/**
 * oc_memory_status tool — inspect memory system state.
 *
 * Shows observation counts, storage size, recent observations,
 * preferences, and per-type breakdowns. Follows the *Core + tool()
 * pattern from create-agent.ts.
 *
 * @module
 */

import { Database } from "bun:sqlite";
import { statSync } from "node:fs";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { DB_FILE, MEMORY_DIR, OBSERVATION_TYPES } from "../memory/constants";
import { getMemoryDb } from "../memory/database";
import { getAllPreferences } from "../memory/repository";
import { getGlobalConfigDir } from "../utils/paths";

interface MemoryStatusResult {
	readonly stats: {
		readonly totalObservations: number;
		readonly totalProjects: number;
		readonly totalPreferences: number;
		readonly storageSizeKb: number;
		readonly observationsByType: Record<string, number>;
	} | null;
	readonly recentObservations: readonly {
		readonly type: string;
		readonly summary: string;
		readonly createdAt: string;
		readonly confidence: number;
	}[];
	readonly preferences: readonly {
		readonly key: string;
		readonly value: string;
		readonly confidence: number;
	}[];
	readonly error?: string;
}

/**
 * Core function for memory status inspection.
 * Accepts a Database instance for testability (or uses the singleton).
 */
export function memoryStatusCore(
	_args: { readonly detail?: "summary" | "full" },
	dbOrPath?: Database | string,
): MemoryStatusResult {
	try {
		const db =
			dbOrPath instanceof Database
				? dbOrPath
				: typeof dbOrPath === "string"
					? new Database(dbOrPath)
					: getMemoryDb();

		// Count observations
		const obsCountRow = db.query("SELECT COUNT(*) as cnt FROM observations").get() as {
			cnt: number;
		};
		const totalObservations = obsCountRow.cnt;

		// Count by type
		const typeRows = db
			.query("SELECT type, COUNT(*) as cnt FROM observations GROUP BY type")
			.all() as Array<{ type: string; cnt: number }>;

		const observationsByType: Record<string, number> = {};
		for (const t of OBSERVATION_TYPES) {
			observationsByType[t] = 0;
		}
		for (const row of typeRows) {
			observationsByType[row.type] = row.cnt;
		}

		// Count projects
		const projCountRow = db.query("SELECT COUNT(*) as cnt FROM projects").get() as {
			cnt: number;
		};
		const totalProjects = projCountRow.cnt;

		// Count preferences
		const prefCountRow = db.query("SELECT COUNT(*) as cnt FROM preferences").get() as {
			cnt: number;
		};
		const totalPreferences = prefCountRow.cnt;

		// Storage size
		let storageSizeKb = 0;
		try {
			const dbPath = join(getGlobalConfigDir(), MEMORY_DIR, DB_FILE);
			const stat = statSync(dbPath);
			storageSizeKb = Math.round(stat.size / 1024);
		} catch {
			// DB might be in-memory or path doesn't exist
		}

		// Recent observations (last 10)
		const recentRows = db
			.query(
				"SELECT type, summary, created_at, confidence FROM observations ORDER BY created_at DESC LIMIT 10",
			)
			.all() as Array<{
			type: string;
			summary: string;
			created_at: string;
			confidence: number;
		}>;

		const recentObservations = recentRows.map((row) => ({
			type: row.type,
			summary: row.summary,
			createdAt: row.created_at,
			confidence: row.confidence,
		}));

		// All preferences
		const allPrefs = getAllPreferences(db);
		const preferences = allPrefs.map((p) => ({
			key: p.key,
			value: p.value,
			confidence: p.confidence,
		}));

		return {
			stats: {
				totalObservations,
				totalProjects,
				totalPreferences,
				storageSizeKb,
				observationsByType,
			},
			recentObservations,
			preferences,
		};
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		return {
			stats: null,
			recentObservations: [],
			preferences: [],
			error: `Memory system error: ${detail}`,
		};
	}
}

export const ocMemoryStatus = tool({
	description:
		"Show memory system status: observation counts, recent memories, preferences, and storage size.",
	args: {
		detail: tool.schema
			.enum(["summary", "full"])
			.default("summary")
			.describe("Level of detail to show"),
	},
	async execute(args) {
		return JSON.stringify(memoryStatusCore(args), null, 2);
	},
});
