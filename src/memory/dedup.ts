import type { Database } from "bun:sqlite";
import { withTransaction } from "../kernel/transaction";
import { DEDUP_JACCARD_THRESHOLD } from "./constants";
import { getMemoryDb } from "./database";
import { memorySchema } from "./schemas";
import type { Memory } from "./types";

interface MemoryRow {
	readonly id: number;
	readonly text_id: string;
	readonly project_id: string | null;
	readonly kind: string;
	readonly scope: string;
	readonly content: string;
	readonly summary: string;
	readonly reasoning: string | null;
	readonly confidence: number;
	readonly evidence_count: number;
	readonly tags: string | null;
	readonly source_session: string | null;
	readonly status: string;
	readonly supersedes_memory_id: string | null;
	readonly access_count: number;
	readonly created_at: string;
	readonly last_updated: string;
	readonly last_accessed: string;
}

function resolveDb(db?: Database): Database {
	return db ?? getMemoryDb();
}

function parseTags(rawTags: string | null): readonly string[] {
	if (rawTags === null || rawTags.trim().length === 0) {
		return [];
	}

	try {
		const parsed = JSON.parse(rawTags) as unknown;
		return Array.isArray(parsed) && parsed.every((tag) => typeof tag === "string") ? parsed : [];
	} catch {
		return [];
	}
}

function rowToMemory(row: MemoryRow): Memory {
	return memorySchema.parse({
		id: row.id,
		textId: row.text_id,
		projectId: row.project_id,
		kind: row.kind,
		scope: row.scope,
		content: row.content,
		summary: row.summary,
		reasoning: row.reasoning,
		confidence: row.confidence,
		evidenceCount: row.evidence_count,
		tags: parseTags(row.tags),
		sourceSession: row.source_session,
		status: row.status,
		supersedesMemoryId: row.supersedes_memory_id,
		accessCount: row.access_count,
		createdAt: row.created_at,
		lastUpdated: row.last_updated,
		lastAccessed: row.last_accessed,
	});
}

function toWordBigrams(text: string): readonly string[] {
	const words = normalizeContent(text)
		.split(" ")
		.filter((word) => word.length > 0);

	if (words.length < 2) {
		return [];
	}

	return Array.from(
		{ length: words.length - 1 },
		(_, index) => `${words[index]} ${words[index + 1]}`,
	);
}

function selectMergedContent(existingContent: string, newContent: string): string {
	const trimmedNewContent = newContent.trim();
	if (trimmedNewContent.length === 0) {
		return existingContent;
	}

	const normalizedExisting = normalizeContent(existingContent);
	const normalizedNew = normalizeContent(trimmedNewContent);
	if (normalizedExisting === normalizedNew) {
		return trimmedNewContent.length > existingContent.length ? trimmedNewContent : existingContent;
	}

	const overlap = computeBigramOverlap(normalizedExisting, normalizedNew);
	if (overlap < 0.85) {
		return trimmedNewContent;
	}

	return trimmedNewContent.length > existingContent.length ? trimmedNewContent : existingContent;
}

export function normalizeContent(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function computeBigramOverlap(a: string, b: string): number {
	const aBigrams = new Set(toWordBigrams(a));
	const bBigrams = new Set(toWordBigrams(b));

	if (aBigrams.size === 0 || bBigrams.size === 0) {
		return 0;
	}

	let intersectionSize = 0;
	for (const bigram of aBigrams) {
		if (bBigrams.has(bigram)) {
			intersectionSize += 1;
		}
	}

	const unionSize = new Set([...aBigrams, ...bBigrams]).size;
	return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

export function findDuplicateCandidate(
	content: string,
	projectId: string | null,
	db?: Database,
): Memory | null {
	const normalizedContent = normalizeContent(content);
	if (normalizedContent.length === 0) {
		return null;
	}

	const d = resolveDb(db);
	const rows = (
		projectId === null
			? d
					.query(
						`SELECT *
					 FROM memories
					 WHERE status = 'active'
					   AND project_id IS NULL
					 ORDER BY last_updated DESC, id DESC`,
					)
					.all()
			: d
					.query(
						`SELECT *
					 FROM memories
					 WHERE status = 'active'
					   AND project_id = ?
					 ORDER BY last_updated DESC, id DESC`,
					)
					.all(projectId)
	) as MemoryRow[];

	for (const row of rows) {
		const candidate = rowToMemory(row);
		if (computeBigramOverlap(normalizedContent, candidate.content) >= DEDUP_JACCARD_THRESHOLD) {
			return candidate;
		}
	}

	return null;
}

export function mergeIntoExisting(
	existingMemory: Memory,
	newContent: string,
	newConfidence: number,
	db?: Database,
): Memory {
	const parsedMemory = memorySchema.parse(existingMemory);
	if (parsedMemory.id === undefined) {
		throw new Error("Cannot merge memory without an id");
	}
	const memoryId = parsedMemory.id;

	const d = resolveDb(db);

	return withTransaction(d, () => {
		const currentRow = d
			.query("SELECT * FROM memories WHERE id = ?")
			.get(memoryId) as MemoryRow | null;

		if (!currentRow) {
			throw new Error(`Memory not found: ${memoryId}`);
		}

		const currentMemory = rowToMemory(currentRow);
		const updatedContent = selectMergedContent(currentMemory.content, newContent);
		const updatedConfidence = Math.max(currentMemory.confidence, newConfidence);
		const updatedEvidenceCount = currentMemory.evidenceCount + 1;
		const updatedLastUpdated = new Date().toISOString();

		d.run(
			`UPDATE memories
			 SET content = ?, confidence = ?, evidence_count = ?, last_updated = ?
			 WHERE id = ?`,
			[updatedContent, updatedConfidence, updatedEvidenceCount, updatedLastUpdated, currentRow.id],
		);

		const updatedRow = d
			.query("SELECT * FROM memories WHERE id = ?")
			.get(currentRow.id) as MemoryRow | null;

		if (!updatedRow) {
			throw new Error(`Failed to reload merged memory: ${currentRow.id}`);
		}

		return rowToMemory(updatedRow);
	});
}
