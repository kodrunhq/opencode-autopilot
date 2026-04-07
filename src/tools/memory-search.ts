import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { getMemoryDb } from "../memory/database";
import { getActiveMemories, searchMemories } from "../memory/memories";
import type { MemoryKind } from "../memory/types";
import { resolveProjectIdentitySync } from "../projects/resolve";

interface MemorySearchArgs {
	readonly query?: string;
	readonly kind?: MemoryKind;
	readonly scope?: "project" | "user" | "all";
	readonly limit?: number;
}

function resolveProjectId(projectRoot: string, db: Database): string | null {
	try {
		const resolved = resolveProjectIdentitySync(projectRoot, {
			db,
			allowCreate: false,
		});
		return resolved.id.startsWith("project:") ? null : resolved.id;
	} catch {
		return null;
	}
}

export function memorySearchCore(
	args: MemorySearchArgs,
	projectRoot: string,
	db?: Database,
): { ok: boolean; memories?: readonly Record<string, unknown>[]; error?: string } {
	try {
		const resolvedDb = db ?? getMemoryDb();
		const limit = args.limit ?? 20;
		const scope = args.scope ?? "all";

		const projectId =
			scope === "project" || scope === "all" ? resolveProjectId(projectRoot, resolvedDb) : null;

		let results: readonly Record<string, unknown>[];

		if (args.query && args.query.trim().length > 0) {
			const projectMemories =
				scope !== "user" && projectId
					? searchMemories(args.query, projectId, limit, resolvedDb)
					: [];
			const userMemories =
				scope !== "project" ? searchMemories(args.query, null, limit, resolvedDb) : [];

			const combined = [...projectMemories, ...userMemories];
			const deduped = new Map<number | undefined, (typeof combined)[number]>();
			for (const mem of combined) {
				if (!deduped.has(mem.id)) {
					deduped.set(mem.id, mem);
				}
			}

			let filtered = [...deduped.values()];
			if (args.kind) {
				filtered = filtered.filter((m) => m.kind === args.kind);
			}

			results = filtered.slice(0, limit).map((m) => ({
				textId: m.textId,
				kind: m.kind,
				scope: m.scope,
				content: m.content,
				summary: m.summary,
				confidence: m.confidence,
				evidenceCount: m.evidenceCount,
				tags: m.tags,
				lastUpdated: m.lastUpdated,
			}));
		} else {
			const projectMemories =
				scope !== "user" && projectId ? [...getActiveMemories(projectId, limit, resolvedDb)] : [];
			const userMemories =
				scope !== "project" ? [...getActiveMemories(null, limit, resolvedDb)] : [];

			const combined = [...projectMemories, ...userMemories];
			const deduped = new Map<number | undefined, (typeof combined)[number]>();
			for (const mem of combined) {
				if (!deduped.has(mem.id)) {
					deduped.set(mem.id, mem);
				}
			}

			let filtered = [...deduped.values()];
			if (args.kind) {
				filtered = filtered.filter((m) => m.kind === args.kind);
			}

			results = filtered.slice(0, limit).map((m) => ({
				textId: m.textId,
				kind: m.kind,
				scope: m.scope,
				content: m.content,
				summary: m.summary,
				confidence: m.confidence,
				evidenceCount: m.evidenceCount,
				tags: m.tags,
				lastUpdated: m.lastUpdated,
			}));
		}

		return { ok: true, memories: results };
	} catch (error: unknown) {
		return {
			ok: false,
			memories: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export const ocMemorySearch = tool({
	description:
		"Search saved memories. Use to find previously recorded preferences, decisions, project facts, mistakes, or workflow rules.",
	args: {
		query: tool.schema
			.string()
			.optional()
			.describe("Search query (FTS match). Omit to list all active memories."),
		kind: tool.schema
			.enum(["preference", "decision", "project_fact", "mistake", "workflow_rule"])
			.optional()
			.describe("Filter by memory kind"),
		scope: tool.schema
			.enum(["project", "user", "all"])
			.default("all")
			.describe("Scope filter: project-only, user-only, or all"),
		limit: tool.schema
			.number()
			.int()
			.min(1)
			.max(100)
			.default(20)
			.describe("Maximum number of results"),
	},
	async execute(args) {
		return JSON.stringify(memorySearchCore(args, process.cwd()), null, 2);
	},
});
