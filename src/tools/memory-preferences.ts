import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import {
	deletePreferenceRecord,
	deletePreferencesByKey,
	getMemoryDb,
	prunePreferenceEvidence,
	prunePreferences,
} from "../memory";
import { resolveProjectIdentitySync } from "../projects/resolve";

type PreferenceScopeArg = "global" | "project";
type PreferenceStatusArg = "candidate" | "confirmed" | "rejected" | "unconfirmed" | "any";

interface MemoryPreferencesArgs {
	readonly subcommand: "delete" | "prune" | "prune-evidence";
	readonly id?: string;
	readonly key?: string;
	readonly scope?: PreferenceScopeArg;
	readonly olderThanDays?: number;
	readonly status?: PreferenceStatusArg;
	readonly keepLatestPerPreference?: number;
}

function resolveProjectId(projectRoot: string, db: Database): string | null {
	const resolved = resolveProjectIdentitySync(projectRoot, {
		db,
		allowCreate: false,
	});
	return resolved.id.startsWith("project:") ? null : resolved.id;
}

export function memoryPreferencesCore(
	args: MemoryPreferencesArgs,
	projectRoot: string,
	db?: Database,
): string {
	try {
		const resolvedDb = db ?? getMemoryDb();
		const scope = args.scope ?? "global";
		const projectId = scope === "project" ? resolveProjectId(projectRoot, resolvedDb) : null;

		if (scope === "project" && projectId === null) {
			return JSON.stringify({
				error: "no_project_preferences",
				message: "No known project identity for current directory.",
			});
		}

		switch (args.subcommand) {
			case "delete": {
				if (typeof args.id === "string" && args.id.trim().length > 0) {
					return JSON.stringify({
						ok: true,
						subcommand: "delete",
						result: deletePreferenceRecord(args.id, resolvedDb),
					});
				}
				if (typeof args.key === "string" && args.key.trim().length > 0) {
					return JSON.stringify({
						ok: true,
						subcommand: "delete",
						result: deletePreferencesByKey(args.key, { scope, projectId }, resolvedDb),
					});
				}
				return JSON.stringify({
					error: "id_or_key_required",
					message: "delete requires either id or key.",
				});
			}

			case "prune": {
				if (typeof args.olderThanDays !== "number" || args.olderThanDays <= 0) {
					return JSON.stringify({
						error: "older_than_days_required",
						message: "prune requires olderThanDays > 0.",
					});
				}
				return JSON.stringify({
					ok: true,
					subcommand: "prune",
					result: prunePreferences(
						{
							olderThanDays: args.olderThanDays,
							scope,
							projectId,
							status: args.status ?? "unconfirmed",
						},
						resolvedDb,
					),
				});
			}

			case "prune-evidence": {
				if (typeof args.olderThanDays !== "number" || args.olderThanDays <= 0) {
					return JSON.stringify({
						error: "older_than_days_required",
						message: "prune-evidence requires olderThanDays > 0.",
					});
				}
				return JSON.stringify({
					ok: true,
					subcommand: "prune-evidence",
					result: prunePreferenceEvidence(
						{
							olderThanDays: args.olderThanDays,
							keepLatestPerPreference: args.keepLatestPerPreference,
							scope,
							projectId,
							status: args.status ?? "any",
						},
						resolvedDb,
					),
				});
			}
		}
	} catch (error: unknown) {
		return JSON.stringify({
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export const ocMemoryPreferences = tool({
	description:
		"Manage learned preferences. Supports delete by id/key and pruning stale preference records or evidence.",
	args: {
		subcommand: tool.schema
			.enum(["delete", "prune", "prune-evidence"])
			.describe("Preference maintenance operation"),
		id: tool.schema.string().optional().describe("Preference record id for delete"),
		key: tool.schema.string().optional().describe("Preference key for delete"),
		scope: tool.schema
			.enum(["global", "project"])
			.default("global")
			.describe("Preference scope filter"),
		olderThanDays: tool.schema
			.number()
			.int()
			.positive()
			.optional()
			.describe("Delete records/evidence older than this many days"),
		status: tool.schema
			.enum(["candidate", "confirmed", "rejected", "unconfirmed", "any"])
			.optional()
			.describe("Preference status filter for prune operations"),
		keepLatestPerPreference: tool.schema
			.number()
			.int()
			.min(0)
			.optional()
			.describe("For prune-evidence, keep this many newest evidence rows per preference"),
	},
	async execute(args) {
		return memoryPreferencesCore(args, process.cwd());
	},
});
