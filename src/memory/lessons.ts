/**
 * Lesson repository operations.
 * Handles retrieval of extracted lessons from past runs.
 */

import type { Database } from "bun:sqlite";
import { lessonMemorySchema } from "../orchestrator/lesson-schemas";
import type { Lesson } from "../orchestrator/lesson-types";
import { getMemoryDb } from "./database";

function resolveDb(db?: Database): Database {
	return db ?? getMemoryDb();
}

function tableExists(db: Database, tableName: string): boolean {
	const row = db
		.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
		.get(tableName) as { name?: string } | null;
	return row?.name === tableName;
}

interface ProjectLessonRow {
	readonly content: string;
	readonly domain: Lesson["domain"];
	readonly extracted_at: string;
	readonly source_phase: Lesson["sourcePhase"];
	readonly last_updated_at: string | null;
}

function listLegacyLessons(projectId: string, db: Database): readonly Lesson[] {
	if (!tableExists(db, "project_lesson_memory")) {
		return Object.freeze([]);
	}

	const row = db
		.query("SELECT state_json FROM project_lesson_memory WHERE project_id = ?")
		.get(projectId) as { state_json?: string } | null;
	if (row?.state_json === undefined) {
		return Object.freeze([]);
	}

	try {
		const parsed = lessonMemorySchema.parse(JSON.parse(row.state_json));
		return Object.freeze(parsed.lessons);
	} catch {
		return Object.freeze([]);
	}
}

function buildLessonsFromRows(rows: readonly ProjectLessonRow[]): readonly Lesson[] {
	return Object.freeze(
		rows.map((row) =>
			Object.freeze({
				content: row.content,
				domain: row.domain,
				extractedAt: row.extracted_at,
				sourcePhase: row.source_phase,
			}),
		),
	);
}

export function listRelevantLessons(
	projectId: string,
	limit = 5,
	db?: Database,
): readonly Lesson[] {
	const d = resolveDb(db);
	if (tableExists(d, "project_lessons")) {
		const rows = d
			.query(
				`SELECT content, domain, extracted_at, source_phase, last_updated_at
				 FROM project_lessons
				 WHERE project_id = ?
				 ORDER BY extracted_at DESC, lesson_id DESC
				 LIMIT ?`,
			)
			.all(projectId, limit) as ProjectLessonRow[];
		if (rows.length > 0) {
			return buildLessonsFromRows(rows);
		}
	}

	return listLegacyLessons(projectId, d).slice(0, limit);
}
