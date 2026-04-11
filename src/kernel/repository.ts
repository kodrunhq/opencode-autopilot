import type { Database } from "bun:sqlite";
import { forensicEventSchema } from "../observability/forensic-schemas";
import type { ForensicEvent } from "../observability/forensic-types";
import { lessonMemorySchema } from "../orchestrator/lesson-schemas";
import type { LessonMemory } from "../orchestrator/lesson-types";
import { pipelineStateSchema } from "../orchestrator/schemas";
import type { PipelineState } from "../orchestrator/types";
import { resolveProjectIdentitySync } from "../projects/resolve";
import { reviewMemorySchema, reviewStateSchema } from "../review/schemas";
import type { ReviewMemory, ReviewState } from "../review/types";
import { getProjectRootFromArtifactDir } from "../utils/paths";
import { kernelDbExists, openKernelDb } from "./database";
import type {
	ActiveReviewStateRow,
	ForensicEventRow,
	PipelineRunRow,
	ProjectLessonMemoryRow,
	ProjectReviewMemoryRow,
} from "./types";
import { KERNEL_STATE_CONFLICT_CODE } from "./types";

function getProjectRoot(path: string): string {
	return getProjectRootFromArtifactDir(path);
}

function resolveProjectId(
	path: string,
	db: Database,
	options?: { readonly?: boolean },
): string {
	const projectRoot = getProjectRoot(path);
	return resolveProjectIdentitySync(projectRoot, {
		db,
		allowCreate: options?.readonly !== true,
	}).id;
}

function parsePipelineStateRow(
	row: PipelineRunRow | null,
): PipelineState | null {
	if (row === null) {
		return null;
	}
	return pipelineStateSchema.parse(JSON.parse(row.state_json));
}

function parseReviewStateRow(
	row: ActiveReviewStateRow | null,
): ReviewState | null {
	if (row === null) {
		return null;
	}
	return reviewStateSchema.parse(JSON.parse(row.state_json));
}

function parseReviewMemoryRow(
	row: ProjectReviewMemoryRow | null,
): ReviewMemory | null {
	if (row === null) {
		return null;
	}
	return reviewMemorySchema.parse(JSON.parse(row.state_json));
}

function parseLessonMemoryRow(
	row: ProjectLessonMemoryRow | null,
): LessonMemory | null {
	if (row === null) {
		return null;
	}
	return lessonMemorySchema.parse(JSON.parse(row.state_json));
}

interface ProjectLessonRow {
	readonly project_id: string;
	readonly content: string;
	readonly domain: LessonMemory["lessons"][number]["domain"];
	readonly extracted_at: string;
	readonly source_phase: LessonMemory["lessons"][number]["sourcePhase"];
	readonly last_updated_at: string | null;
}

function parseLessonRows(rows: readonly ProjectLessonRow[]): LessonMemory {
	if (rows.length === 0) {
		return lessonMemorySchema.parse({
			schemaVersion: 1,
			lessons: [],
			lastUpdatedAt: null,
		});
	}

	return lessonMemorySchema.parse({
		schemaVersion: 1,
		lessons: rows.map((row) => ({
			content: row.content,
			domain: row.domain,
			extractedAt: row.extracted_at,
			sourcePhase: row.source_phase,
		})),
		lastUpdatedAt: rows[0]?.last_updated_at ?? null,
	});
}

function parseForensicEventRow(row: ForensicEventRow): ForensicEvent {
	return forensicEventSchema.parse({
		schemaVersion: row.schema_version,
		timestamp: row.timestamp,
		projectRoot: row.project_root,
		domain: row.domain,
		runId: row.run_id,
		sessionId: row.session_id,
		parentSessionId: row.parent_session_id,
		phase: row.phase,
		dispatchId: row.dispatch_id,
		taskId: row.task_id,
		agent: row.agent,
		type: row.type,
		code: row.code,
		message: row.message,
		payload: JSON.parse(row.payload_json) as ForensicEvent["payload"],
	});
}

function getLatestPipelineRow(
	db: Database,
	projectId: string,
): PipelineRunRow | null {
	return db
		.query(
			`SELECT *
			 FROM pipeline_runs
			 WHERE project_id = ?
			 ORDER BY last_updated_at DESC, run_id DESC
			 LIMIT 1`,
		)
		.get(projectId) as PipelineRunRow | null;
}

function withWriteTransaction<T>(db: Database, callback: () => T): T {
	db.run("BEGIN IMMEDIATE");
	try {
		const result = callback();
		db.run("COMMIT");
		return result;
	} catch (error: unknown) {
		try {
			db.run("ROLLBACK");
		} catch {
			// Ignore rollback errors so the original failure wins.
		}
		throw error;
	}
}

function tableExists(db: Database, tableName: string): boolean {
	const row = db
		.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
		.get(tableName) as { name?: string } | null;
	return row?.name === tableName;
}

export function loadLatestPipelineStateFromKernel(
	artifactDir: string,
): PipelineState | null {
	if (!kernelDbExists(artifactDir)) {
		return null;
	}

	const db = openKernelDb(artifactDir, { readonly: true });
	try {
		const projectId = resolveProjectId(artifactDir, db, { readonly: true });
		return parsePipelineStateRow(getLatestPipelineRow(db, projectId));
	} finally {
		db.close();
	}
}

export function savePipelineStateToKernel(
	artifactDir: string,
	state: PipelineState,
	expectedRevision?: number,
): void {
	const validated = pipelineStateSchema.parse(state);
	const db = openKernelDb(artifactDir);
	try {
		const projectId = resolveProjectId(artifactDir, db);
		withWriteTransaction(db, () => {
			const current = getLatestPipelineRow(db, projectId);
			const currentRevision = current?.state_revision ?? -1;
			if (
				typeof expectedRevision === "number" &&
				currentRevision !== expectedRevision
			) {
				throw new Error(
					`${KERNEL_STATE_CONFLICT_CODE}: expected stateRevision ${expectedRevision}, found ${currentRevision}`,
				);
			}

			db.run(
				`INSERT INTO pipeline_runs (
					project_id,
					run_id,
					schema_version,
					status,
					current_phase,
					idea,
					state_revision,
					started_at,
					last_updated_at,
					failure_phase,
					failure_agent,
					failure_message,
					last_successful_phase,
					state_json
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(run_id) DO UPDATE SET
					project_id = excluded.project_id,
					schema_version = excluded.schema_version,
					status = excluded.status,
					current_phase = excluded.current_phase,
					idea = excluded.idea,
					state_revision = excluded.state_revision,
					started_at = excluded.started_at,
					last_updated_at = excluded.last_updated_at,
					failure_phase = excluded.failure_phase,
					failure_agent = excluded.failure_agent,
					failure_message = excluded.failure_message,
					last_successful_phase = excluded.last_successful_phase,
					state_json = excluded.state_json`,
				[
					projectId,
					validated.runId,
					validated.schemaVersion,
					validated.status,
					validated.currentPhase,
					validated.idea,
					validated.stateRevision,
					validated.startedAt,
					validated.lastUpdatedAt,
					validated.failureContext?.failedPhase ?? null,
					validated.failureContext?.failedAgent ?? null,
					validated.failureContext?.errorMessage ?? null,
					validated.failureContext?.lastSuccessfulPhase ?? null,
					JSON.stringify(validated),
				],
			);

			db.run("DELETE FROM run_phases WHERE run_id = ?", [validated.runId]);
			for (const phase of validated.phases) {
				db.run(
					`INSERT INTO run_phases (run_id, phase_name, status, completed_at, confidence)
					 VALUES (?, ?, ?, ?, ?)`,
					[
						validated.runId,
						phase.name,
						phase.status,
						phase.completedAt,
						phase.confidence,
					],
				);
			}

			db.run("DELETE FROM run_tasks WHERE run_id = ?", [validated.runId]);
			for (const task of validated.tasks) {
				db.run(
					`INSERT INTO run_tasks (
						run_id,
						task_id,
						title,
						status,
						wave,
						depends_on_json,
						attempt,
						strike
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						validated.runId,
						task.id,
						task.title,
						task.status,
						task.wave,
						JSON.stringify(task.depends_on),
						task.attempt,
						task.strike,
					],
				);
			}

			db.run("DELETE FROM run_pending_dispatches WHERE run_id = ?", [
				validated.runId,
			]);
			for (const pending of validated.pendingDispatches) {
				db.run(
					`INSERT INTO run_pending_dispatches (
					run_id,
					dispatch_id,
					phase,
					agent,
					issued_at,
					result_kind,
					task_id,
					session_id
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						validated.runId,
						pending.dispatchId,
						pending.phase,
						pending.agent,
						pending.issuedAt,
						pending.resultKind,
						pending.taskId,
						pending.sessionId ?? null,
					],
				);
			}

			db.run("DELETE FROM run_processed_results WHERE run_id = ?", [
				validated.runId,
			]);
			for (const resultId of validated.processedResultIds) {
				db.run(
					`INSERT INTO run_processed_results (run_id, result_id) VALUES (?, ?)`,
					[validated.runId, resultId],
				);
			}
		});
	} finally {
		db.close();
	}
}

export function loadActiveReviewStateFromKernel(
	artifactDir: string,
): ReviewState | null {
	if (!kernelDbExists(artifactDir)) {
		return null;
	}

	const db = openKernelDb(artifactDir, { readonly: true });
	try {
		const projectId = resolveProjectId(artifactDir, db, { readonly: true });
		const row = db
			.query("SELECT * FROM active_review_state WHERE project_id = ?")
			.get(projectId) as ActiveReviewStateRow | null;
		return parseReviewStateRow(row);
	} finally {
		db.close();
	}
}

export function saveActiveReviewStateToKernel(
	artifactDir: string,
	state: ReviewState,
): void {
	const validated = reviewStateSchema.parse(state);
	const db = openKernelDb(artifactDir);
	try {
		const projectId = resolveProjectId(artifactDir, db);
		db.run(
			`INSERT INTO active_review_state (project_id, stage, scope, started_at, saved_at, state_json)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(project_id) DO UPDATE SET
				stage = excluded.stage,
				scope = excluded.scope,
				started_at = excluded.started_at,
				saved_at = excluded.saved_at,
				state_json = excluded.state_json`,
			[
				projectId,
				validated.stage,
				validated.scope,
				validated.startedAt,
				new Date().toISOString(),
				JSON.stringify(validated),
			],
		);
	} finally {
		db.close();
	}
}

export function clearActiveReviewStateInKernel(artifactDir: string): void {
	if (!kernelDbExists(artifactDir)) {
		return;
	}

	const db = openKernelDb(artifactDir);
	try {
		const projectId = resolveProjectId(artifactDir, db);
		db.run("DELETE FROM active_review_state WHERE project_id = ?", [projectId]);
	} finally {
		db.close();
	}
}

export function loadReviewMemoryFromKernel(
	artifactDir: string,
): ReviewMemory | null {
	if (!kernelDbExists(artifactDir)) {
		return null;
	}

	const db = openKernelDb(artifactDir, { readonly: true });
	try {
		const projectId = resolveProjectId(artifactDir, db, { readonly: true });
		const row = db
			.query("SELECT * FROM project_review_memory WHERE project_id = ?")
			.get(projectId) as ProjectReviewMemoryRow | null;
		return parseReviewMemoryRow(row);
	} finally {
		db.close();
	}
}

export function saveReviewMemoryToKernel(
	artifactDir: string,
	memory: ReviewMemory,
): void {
	const validated = reviewMemorySchema.parse(memory);
	const db = openKernelDb(artifactDir);
	try {
		const projectId = resolveProjectId(artifactDir, db);
		db.run(
			`INSERT INTO project_review_memory (project_id, schema_version, last_reviewed_at, state_json)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(project_id) DO UPDATE SET
				schema_version = excluded.schema_version,
				last_reviewed_at = excluded.last_reviewed_at,
				state_json = excluded.state_json`,
			[
				projectId,
				validated.schemaVersion,
				validated.lastReviewedAt,
				JSON.stringify(validated),
			],
		);
	} finally {
		db.close();
	}
}

export function loadLessonMemoryFromKernel(
	artifactDir: string,
): LessonMemory | null {
	if (!kernelDbExists(artifactDir)) {
		return null;
	}

	const db = openKernelDb(artifactDir, { readonly: true });
	try {
		const projectId = resolveProjectId(artifactDir, db, { readonly: true });
		if (tableExists(db, "project_lessons")) {
			const lessonRows = db
				.query(
					`SELECT project_id, content, domain, extracted_at, source_phase, last_updated_at
					 FROM project_lessons
					 WHERE project_id = ?
					 ORDER BY extracted_at DESC, lesson_id DESC`,
				)
				.all(projectId) as ProjectLessonRow[];
			if (lessonRows.length > 0) {
				return parseLessonRows(lessonRows);
			}
		}

		if (!tableExists(db, "project_lesson_memory")) {
			return null;
		}

		const row = db
			.query("SELECT * FROM project_lesson_memory WHERE project_id = ?")
			.get(projectId) as ProjectLessonMemoryRow | null;
		return parseLessonMemoryRow(row);
	} finally {
		db.close();
	}
}

export function saveLessonMemoryToKernel(
	artifactDir: string,
	memory: LessonMemory,
): void {
	const validated = lessonMemorySchema.parse(memory);
	const db = openKernelDb(artifactDir);
	try {
		const projectId = resolveProjectId(artifactDir, db);
		withWriteTransaction(db, () => {
			db.run(
				`INSERT INTO project_lesson_memory (project_id, schema_version, last_updated_at, state_json)
				 VALUES (?, ?, ?, ?)
				 ON CONFLICT(project_id) DO UPDATE SET
					schema_version = excluded.schema_version,
					last_updated_at = excluded.last_updated_at,
					state_json = excluded.state_json`,
				[
					projectId,
					validated.schemaVersion,
					validated.lastUpdatedAt,
					JSON.stringify(validated),
				],
			);

			db.run("DELETE FROM project_lessons WHERE project_id = ?", [projectId]);
			for (const lesson of validated.lessons) {
				db.run(
					`INSERT INTO project_lessons (
						project_id,
						content,
						domain,
						extracted_at,
						source_phase,
						last_updated_at
					) VALUES (?, ?, ?, ?, ?, ?)`,
					[
						projectId,
						lesson.content,
						lesson.domain,
						lesson.extractedAt,
						lesson.sourcePhase,
						validated.lastUpdatedAt,
					],
				);
			}
		});
	} finally {
		db.close();
	}
}

export function countForensicEventsInKernel(artifactDir: string): number {
	if (!kernelDbExists(artifactDir)) {
		return 0;
	}

	const db = openKernelDb(artifactDir, { readonly: true });
	try {
		const projectId = resolveProjectId(artifactDir, db, { readonly: true });
		const row = db
			.query(
				"SELECT COUNT(*) as count FROM forensic_events WHERE project_id = ?",
			)
			.get(projectId) as {
			count?: number;
		} | null;
		return row?.count ?? 0;
	} finally {
		db.close();
	}
}

export function appendForensicEventsToKernel(
	artifactDir: string,
	events: readonly ForensicEvent[],
): void {
	if (events.length === 0) {
		return;
	}

	const validated = events.map((event) => forensicEventSchema.parse(event));
	const db = openKernelDb(artifactDir);
	try {
		const projectId = resolveProjectId(artifactDir, db);
		withWriteTransaction(db, () => {
			for (const event of validated) {
				db.run(
					`INSERT INTO forensic_events (
						project_id,
						schema_version,
						timestamp,
						project_root,
						domain,
						run_id,
						session_id,
						parent_session_id,
						phase,
						dispatch_id,
						task_id,
						agent,
						type,
						code,
						message,
						payload_json
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						projectId,
						event.schemaVersion,
						event.timestamp,
						event.projectRoot,
						event.domain,
						event.runId,
						event.sessionId,
						event.parentSessionId,
						event.phase,
						event.dispatchId,
						event.taskId,
						event.agent,
						event.type,
						event.code,
						event.message,
						JSON.stringify(event.payload),
					],
				);
			}
		});
	} finally {
		db.close();
	}
}

export function loadForensicEventsFromKernel(
	artifactDir: string,
): readonly ForensicEvent[] {
	if (!kernelDbExists(artifactDir)) {
		return Object.freeze([]);
	}

	const db = openKernelDb(artifactDir, { readonly: true });
	try {
		const projectId = resolveProjectId(artifactDir, db, { readonly: true });
		const rows = db
			.query(
				`SELECT *
				 FROM forensic_events
				 WHERE project_id = ?
				 ORDER BY timestamp ASC, event_id ASC`,
			)
			.all(projectId) as ForensicEventRow[];
		return Object.freeze(rows.map(parseForensicEventRow));
	} finally {
		db.close();
	}
}
