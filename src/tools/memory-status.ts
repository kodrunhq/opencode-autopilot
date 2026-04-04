/**
 * oc_memory_status tool — inspect memory system state.
 *
 * Shows observation counts, storage size, recent observations,
 * preferences, and per-type breakdowns through the shared inspection
 * query layer.
 *
 * @module
 */

import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { getMemoryOverview } from "../inspect/repository";

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
		const overview = getMemoryOverview(dbOrPath);

		return {
			stats: overview.stats,
			recentObservations: overview.recentObservations.map((row) => ({
				type: row.type,
				summary: row.summary,
				createdAt: row.createdAt,
				confidence: row.confidence,
			})),
			preferences: overview.preferences.map((row) => ({
				key: row.key,
				value: row.value,
				confidence: row.confidence,
			})),
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
