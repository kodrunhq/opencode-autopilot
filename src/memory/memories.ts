import type { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { withTransaction } from "../kernel/transaction";
import {
	DEFAULT_MEMORY_CONFIDENCE,
	MAX_MEMORIES_PER_QUERY,
	MAX_MEMORY_SUMMARY_LENGTH,
	MEMORY_KINDS,
} from "./constants";
import { getMemoryDb } from "./database";
import { findDuplicateCandidate, mergeIntoExisting } from "./dedup";
import { memoryEvidenceSchema, memorySchema } from "./schemas";
import type { Memory, MemoryEvidence, MemoryKind, MemoryScope } from "./types";

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
	readonly topic_group: string | null;
	readonly topic: string | null;
	readonly source_kind: string;
	readonly source_session: string | null;
	readonly status: string;
	readonly supersedes_memory_id: string | null;
	readonly access_count: number;
	readonly created_at: string;
	readonly last_updated: string;
	readonly last_accessed: string;
}

interface PreferenceRecordRow {
	readonly key: string;
	readonly value: string;
	readonly scope: "global" | "project";
	readonly project_id: string | null;
	readonly source_session: string | null;
	readonly confidence: number;
	readonly status: "candidate" | "confirmed" | "rejected";
	readonly created_at: string;
	readonly last_updated: string;
}

export interface SaveMemoryInput {
	readonly kind: MemoryKind;
	readonly content: string;
	readonly summary: string;
	readonly reasoning?: string | null;
	readonly tags?: readonly string[];
	readonly topicGroup?: string | null;
	readonly topic?: string | null;
	readonly sourceKind?: "curated" | "raw_attachment";
	readonly scope?: MemoryScope;
	readonly projectId?: string | null;
	readonly sourceSession?: string | null;
	readonly confidence?: number;
}

export interface MemorySearchFilters {
	readonly topicGroup?: string;
	readonly topic?: string;
}

function resolveDb(db?: Database): Database {
	return db ?? getMemoryDb();
}

function parseMemoryKind(value: string): MemoryKind {
	if ((MEMORY_KINDS as readonly string[]).includes(value)) {
		return value as MemoryKind;
	}

	throw new Error(`Invalid memory kind: ${value}`);
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
		kind: parseMemoryKind(row.kind),
		scope: row.scope,
		content: row.content,
		summary: row.summary,
		reasoning: row.reasoning,
		confidence: row.confidence,
		evidenceCount: row.evidence_count,
		tags: parseTags(row.tags),
		topicGroup: row.topic_group ?? null,
		topic: row.topic ?? null,
		sourceKind: (["curated", "raw_attachment"].includes(row.source_kind)
			? row.source_kind
			: "curated") as "curated" | "raw_attachment",
		sourceSession: row.source_session,
		status: row.status,
		supersedesMemoryId: row.supersedes_memory_id,
		accessCount: row.access_count,
		createdAt: row.created_at,
		lastUpdated: row.last_updated,
		lastAccessed: row.last_accessed,
	});
}

function getMemoryByNumericId(id: number, db: Database): Memory | null {
	const row = db.query("SELECT * FROM memories WHERE id = ?").get(id) as MemoryRow | null;
	return row ? rowToMemory(row) : null;
}

function createEvidence(
	memoryId: number,
	statement: string,
	sessionId: string | null,
	confidence: number,
	createdAt: string,
): MemoryEvidence {
	return memoryEvidenceSchema.parse({
		id: randomUUID(),
		memoryId,
		sessionId,
		statement,
		statementHash: createHash("sha256").update(statement).digest("hex"),
		confidence,
		createdAt,
	});
}

function insertEvidence(evidence: MemoryEvidence, db: Database): boolean {
	const result = db.run(
		`INSERT OR IGNORE INTO memory_evidence (
			id,
			memory_id,
			session_id,
			statement,
			statement_hash,
			confidence,
			created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			evidence.id,
			evidence.memoryId,
			evidence.sessionId,
			evidence.statement,
			evidence.statementHash,
			evidence.confidence,
			evidence.createdAt,
		],
	);
	return result.changes > 0;
}

function normalizeScope(projectId: string | null, scope?: MemoryScope): MemoryScope {
	if (scope) {
		return scope;
	}

	return projectId === null ? "user" : "project";
}

export function saveMemory(input: SaveMemoryInput, db?: Database): Memory {
	const d = resolveDb(db);
	const now = new Date().toISOString();
	const projectId = input.projectId ?? null;
	const confidence = input.confidence ?? DEFAULT_MEMORY_CONFIDENCE;
	const validated = memorySchema
		.omit({
			id: true,
			textId: true,
			evidenceCount: true,
			status: true,
			supersedesMemoryId: true,
			accessCount: true,
			createdAt: true,
			lastUpdated: true,
			lastAccessed: true,
		})
		.parse({
			projectId,
			kind: input.kind,
			scope: normalizeScope(projectId, input.scope),
			content: input.content,
			summary: input.summary,
			reasoning: input.reasoning ?? null,
			confidence,
			tags: input.tags ?? [],
			topicGroup: input.topicGroup ?? null,
			topic: input.topic ?? null,
			sourceKind: input.sourceKind ?? "curated",
			sourceSession: input.sourceSession ?? null,
		});

	const duplicate = findDuplicateCandidate(
		validated.content,
		validated.projectId,
		validated.kind,
		d,
	);
	if (duplicate) {
		const merged = mergeIntoExisting(
			duplicate,
			validated.content,
			validated.confidence,
			d,
			validated.topicGroup,
			validated.topic,
		);
		if (merged.id === undefined) {
			throw new Error("Merged memory is missing an id");
		}
		const mergedId = merged.id;

		const evidence = createEvidence(
			mergedId,
			validated.content,
			validated.sourceSession,
			validated.confidence,
			now,
		);
		withTransaction(d, () => {
			const inserted = insertEvidence(evidence, d);
			if (inserted) {
				d.run("UPDATE memories SET evidence_count = evidence_count + 1 WHERE id = ?", [mergedId]);
			}
		});

		const reloaded = getMemoryByNumericId(mergedId, d);
		if (reloaded === null) {
			throw new Error(`Failed to reload memory: ${merged.id}`);
		}

		return reloaded;
	}

	return withTransaction(d, () => {
		const inserted = d
			.query<
				{ id: number },
				[
					string,
					string | null,
					MemoryKind,
					MemoryScope,
					string,
					string,
					string | null,
					number,
					number,
					string,
					string | null,
					string | null,
					"curated" | "raw_attachment",
					string | null,
					string,
					string,
					string,
				]
			>(
				`INSERT INTO memories (
					text_id,
					project_id,
					kind,
					scope,
					content,
					summary,
					reasoning,
					confidence,
					evidence_count,
					tags,
					topic_group,
					topic,
					source_kind,
					source_session,
					created_at,
					last_updated,
					last_accessed
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				RETURNING id`,
			)
			.get(
				randomUUID(),
				validated.projectId,
				validated.kind,
				validated.scope,
				validated.content,
				validated.summary,
				validated.reasoning,
				validated.confidence,
				1,
				JSON.stringify(validated.tags),
				validated.topicGroup ?? null,
				validated.topic ?? null,
				validated.sourceKind ?? "curated",
				validated.sourceSession,
				now,
				now,
				now,
			);

		if (!inserted) {
			throw new Error("Failed to insert memory");
		}

		insertEvidence(
			createEvidence(
				inserted.id,
				validated.content,
				validated.sourceSession,
				validated.confidence,
				now,
			),
			d,
		);

		const memory = getMemoryByNumericId(inserted.id, d);
		if (memory === null) {
			throw new Error(`Failed to reload memory: ${inserted.id}`);
		}

		return memory;
	});
}

export function searchMemories(
	query: string,
	projectId: string | null,
	limit = MAX_MEMORIES_PER_QUERY,
	db?: Database,
	filters?: MemorySearchFilters,
): Array<Memory & { ftsRank: number }> {
	const d = resolveDb(db);
	const safeFtsQuery = `"${query.replace(/"/g, '""')}"`;
	const projectFilter = projectId === null ? "AND m.project_id IS NULL" : "AND m.project_id = ?";
	const topicGroupFilter = filters?.topicGroup ? "AND m.topic_group = ?" : "";
	const topicFilter = filters?.topic ? "AND m.topic = ?" : "";
	const params: Array<string | number> = [safeFtsQuery];
	if (projectId !== null) {
		params.push(projectId);
	}
	if (filters?.topicGroup) {
		params.push(filters.topicGroup);
	}
	if (filters?.topic) {
		params.push(filters.topic);
	}
	params.push(limit);

	const rows = d
		.query(
			`SELECT m.*, bm25(memories_fts) as fts_rank
			 FROM memories_fts f
			 JOIN memories m ON m.id = f.rowid
			 WHERE memories_fts MATCH ?
			   AND m.status = 'active'
			   ${projectFilter}
			   ${topicGroupFilter}
			   ${topicFilter}
			 ORDER BY fts_rank
			 LIMIT ?`,
		)
		.all(...params) as Array<MemoryRow & { readonly fts_rank: number }>;

	return rows.map((row) => ({
		...rowToMemory(row),
		ftsRank: row.fts_rank,
	}));
}

export function getActiveMemories(
	projectId: string | null,
	limit = MAX_MEMORIES_PER_QUERY,
	db?: Database,
	filters?: MemorySearchFilters,
): readonly Memory[] {
	const d = resolveDb(db);
	const topicGroupFilter = filters?.topicGroup ? "AND topic_group = ?" : "";
	const topicFilter = filters?.topic ? "AND topic = ?" : "";
	const rows = (
		projectId === null
			? d
					.query(
						`SELECT *
						 FROM memories
						 WHERE status = 'active'
						   AND project_id IS NULL
						   ${topicGroupFilter}
						   ${topicFilter}
						 ORDER BY last_updated DESC, id DESC
						 LIMIT ?`,
					)
					.all(
						...(filters?.topicGroup ? [filters.topicGroup] : []),
						...(filters?.topic ? [filters.topic] : []),
						limit,
					)
			: d
					.query(
						`SELECT *
						 FROM memories
						 WHERE status = 'active'
						   AND project_id = ?
						   ${topicGroupFilter}
						   ${topicFilter}
						 ORDER BY last_updated DESC, id DESC
						 LIMIT ?`,
					)
					.all(
						projectId,
						...(filters?.topicGroup ? [filters.topicGroup] : []),
						...(filters?.topic ? [filters.topic] : []),
						limit,
					)
	) as MemoryRow[];

	return Object.freeze(rows.map(rowToMemory));
}

export function forgetMemory(textId: string, db?: Database): boolean {
	const d = resolveDb(db);
	const result = d.run(
		`UPDATE memories
		 SET status = 'rejected', last_updated = ?
		 WHERE text_id = ?
		   AND status = 'active'`,
		[new Date().toISOString(), textId],
	);
	return result.changes > 0;
}

export function getMemoryById(textId: string, db?: Database): Memory | null {
	const d = resolveDb(db);
	const row = d.query("SELECT * FROM memories WHERE text_id = ?").get(textId) as MemoryRow | null;
	return row ? rowToMemory(row) : null;
}

export function migratePreferencesToMemories(db?: Database): { migrated: number; skipped: number } {
	const d = resolveDb(db);

	const marker = d.query("SELECT value FROM memory_meta WHERE key = 'v1_migration_done'").get() as {
		value: string;
	} | null;
	if (marker) {
		return { migrated: 0, skipped: 0 };
	}

	const rows = d
		.query(
			`SELECT key, value, scope, project_id, source_session, confidence, status, created_at, last_updated
			 FROM preference_records
			 WHERE status = 'confirmed'
			 ORDER BY last_updated DESC, key ASC`,
		)
		.all() as PreferenceRecordRow[];

	let migrated = 0;
	let skipped = 0;

	for (const row of rows) {
		const content = `${row.key}: ${row.value}`;
		const duplicate = findDuplicateCandidate(content, row.project_id, "preference", d);
		if (duplicate) {
			skipped += 1;
			continue;
		}

		saveMemory(
			{
				kind: "preference",
				content,
				summary: row.value.slice(0, MAX_MEMORY_SUMMARY_LENGTH),
				scope: row.scope === "global" ? "user" : "project",
				projectId: row.scope === "project" ? row.project_id : null,
				sourceSession: row.source_session,
				confidence: row.confidence,
			},
			d,
		);
		migrated += 1;
	}

	d.run("INSERT OR REPLACE INTO memory_meta (key, value) VALUES ('v1_migration_done', ?)", [
		new Date().toISOString(),
	]);

	return { migrated, skipped };
}
