import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { getMemoryDb } from "../memory/database";
import { notifyMemoryChanged } from "../memory/injector";
import { saveMemory } from "../memory/memories";
import type { MemoryKind, MemoryScope } from "../memory/types";
import { resolveProjectIdentitySync } from "../projects/resolve";

interface MemorySaveArgs {
	readonly kind: MemoryKind;
	readonly content: string;
	readonly summary: string;
	readonly reasoning?: string;
	readonly tags?: readonly string[];
	readonly scope?: MemoryScope;
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

export function memorySaveCore(
	args: MemorySaveArgs,
	projectRoot: string,
	db?: Database,
	sessionId?: string,
): { ok: boolean; memory?: Record<string, unknown>; error?: string } {
	try {
		const resolvedDb = db ?? getMemoryDb();
		const scope = args.scope ?? "user";
		const projectId = scope === "project" ? resolveProjectId(projectRoot, resolvedDb) : null;

		if (scope === "project" && projectId === null) {
			return {
				ok: false,
				error:
					"Cannot save project-scoped memory: no known project identity for current directory.",
			};
		}

		const memory = saveMemory(
			{
				kind: args.kind,
				content: args.content,
				summary: args.summary,
				reasoning: args.reasoning ?? null,
				tags: args.tags ?? [],
				scope,
				projectId,
				sourceSession: sessionId ?? null,
				confidence: undefined,
			},
			resolvedDb,
		);

		notifyMemoryChanged();

		return {
			ok: true,
			memory: {
				textId: memory.textId,
				kind: memory.kind,
				scope: memory.scope,
				summary: memory.summary,
				confidence: memory.confidence,
				evidenceCount: memory.evidenceCount,
				status: memory.status,
			},
		};
	} catch (error: unknown) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export const ocMemorySave = tool({
	description:
		"Save a meaningful memory (preference, decision, project fact, mistake, or workflow rule). Call this when you observe something worth remembering for future sessions.",
	args: {
		kind: tool.schema
			.enum(["preference", "decision", "project_fact", "mistake", "workflow_rule"])
			.describe(
				"Memory category: preference (user likes/dislikes), decision (architectural/tooling choice), project_fact (tech stack, conventions), mistake (error to avoid), workflow_rule (process requirement)",
			),
		content: tool.schema
			.string()
			.min(1)
			.max(4000)
			.describe("Full memory content with enough context to be useful in future sessions"),
		summary: tool.schema.string().min(1).max(500).describe("One-line summary of the memory"),
		reasoning: tool.schema.string().max(1000).optional().describe("Why this is worth remembering"),
		tags: tool.schema
			.array(tool.schema.string().min(1).max(50))
			.max(10)
			.optional()
			.describe("Tags for categorization (e.g., ['typescript', 'testing'])"),
		scope: tool.schema
			.enum(["project", "user"])
			.default("user")
			.describe("Scope: project (specific to current project) or user (applies globally)"),
	},
	async execute(args, context) {
		return JSON.stringify(
			memorySaveCore(args, process.cwd(), undefined, context.sessionID),
			null,
			2,
		);
	},
});
