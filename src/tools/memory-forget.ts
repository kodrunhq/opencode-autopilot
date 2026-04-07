import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { getMemoryDb } from "../memory/database";
import { forgetMemory, getMemoryById } from "../memory/memories";

interface MemoryForgetArgs {
	readonly textId: string;
	readonly reason?: string;
}

export function memoryForgetCore(
	args: MemoryForgetArgs,
	db?: Database,
): { ok: boolean; forgotten?: boolean; memory?: Record<string, unknown>; error?: string } {
	try {
		const resolvedDb = db ?? getMemoryDb();

		const existing = getMemoryById(args.textId, resolvedDb);
		if (!existing) {
			return {
				ok: false,
				forgotten: false,
				error: `Memory not found: ${args.textId}`,
			};
		}

		if (existing.status !== "active") {
			return {
				ok: false,
				forgotten: false,
				error: `Memory is already ${existing.status}: ${args.textId}`,
			};
		}

		const forgotten = forgetMemory(args.textId, resolvedDb);

		return {
			ok: true,
			forgotten,
			memory: {
				textId: existing.textId,
				kind: existing.kind,
				summary: existing.summary,
			},
		};
	} catch (error: unknown) {
		return {
			ok: false,
			forgotten: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export const ocMemoryForget = tool({
	description:
		"Forget (soft-delete) a saved memory. Use when a memory is no longer relevant or was saved incorrectly.",
	args: {
		textId: tool.schema
			.string()
			.min(1)
			.describe("The text_id of the memory to forget (from search results)"),
		reason: tool.schema
			.string()
			.max(500)
			.optional()
			.describe("Why this memory should be forgotten"),
	},
	async execute(args) {
		return JSON.stringify(memoryForgetCore(args), null, 2);
	},
});
