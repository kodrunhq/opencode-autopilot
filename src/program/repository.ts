import type { Database } from "bun:sqlite";
import { kernelDbExists, openProjectKernelDb } from "../kernel/database";
import { resolveProjectIdentitySync } from "../projects/resolve";
import { getProjectArtifactDir, getProjectRootFromArtifactDir } from "../utils/paths";
import { programRunSchema } from "./schemas";
import type { ProgramRun } from "./types";

interface ProgramRunRow {
	readonly state_json: string;
}

function parseProgramRunRow(row: ProgramRunRow | null): ProgramRun | null {
	if (row === null) {
		return null;
	}
	return programRunSchema.parse(JSON.parse(row.state_json));
}

function getProjectId(db: Database, artifactDir: string, isReadonly: boolean): string {
	const projectRoot = getProjectRootFromArtifactDir(artifactDir);
	return resolveProjectIdentitySync(projectRoot, {
		db,
		allowCreate: !isReadonly,
	}).id;
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
			// Keep the original error.
		}
		throw error;
	}
}

export function loadLatestProgramRunFromKernel(artifactDir: string): ProgramRun | null {
	const projectRoot = getProjectRootFromArtifactDir(artifactDir);
	if (!kernelDbExists(getProjectArtifactDir(projectRoot))) {
		return null;
	}
	const db = openProjectKernelDb(projectRoot, { readonly: true });
	try {
		const projectId = getProjectId(db, artifactDir, true);
		const row = db
			.query(
				`SELECT state_json
				 FROM program_runs
				 WHERE project_id = ?
				 ORDER BY created_at DESC, program_id DESC
				 LIMIT 1`,
			)
			.get(projectId) as ProgramRunRow | null;
		return parseProgramRunRow(row);
	} finally {
		db.close();
	}
}

export function loadProgramRunFromKernel(
	artifactDir: string,
	programId: string,
): ProgramRun | null {
	const projectRoot = getProjectRootFromArtifactDir(artifactDir);
	if (!kernelDbExists(getProjectArtifactDir(projectRoot))) {
		return null;
	}
	const db = openProjectKernelDb(projectRoot, { readonly: true });
	try {
		const row = db
			.query(
				`SELECT state_json
				 FROM program_runs
				 WHERE program_id = ?
				 LIMIT 1`,
			)
			.get(programId) as ProgramRunRow | null;
		return parseProgramRunRow(row);
	} finally {
		db.close();
	}
}

export function saveProgramRunToKernel(artifactDir: string, program: ProgramRun): void {
	const validated = programRunSchema.parse(program);
	const projectRoot = getProjectRootFromArtifactDir(artifactDir);
	const db = openProjectKernelDb(projectRoot);
	try {
		const projectId = getProjectId(db, artifactDir, false);
		withWriteTransaction(db, () => {
			db.run(
				`INSERT INTO program_runs (
					project_id,
					program_id,
					schema_version,
					status,
					mode,
					originating_request,
					created_at,
					current_tranche_id,
					final_oracle_verdict,
					success_criteria_json,
					blocked_reason,
					state_json
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(program_id) DO UPDATE SET
					project_id = excluded.project_id,
					schema_version = excluded.schema_version,
					status = excluded.status,
					mode = excluded.mode,
					originating_request = excluded.originating_request,
					created_at = excluded.created_at,
					current_tranche_id = excluded.current_tranche_id,
					final_oracle_verdict = excluded.final_oracle_verdict,
					success_criteria_json = excluded.success_criteria_json,
					blocked_reason = excluded.blocked_reason,
					state_json = excluded.state_json`,
				[
					projectId,
					validated.programId,
					validated.schemaVersion,
					validated.status,
					validated.mode,
					validated.originatingRequest,
					validated.createdAt,
					validated.currentTrancheId,
					validated.finalOracleVerdict,
					JSON.stringify(validated.successCriteria),
					validated.blockedReason,
					JSON.stringify(validated),
				],
			);

			db.run("DELETE FROM program_tranches WHERE program_id = ?", [validated.programId]);
			for (const tranche of validated.tranches) {
				db.run(
					`INSERT INTO program_tranches (
						program_id,
						tranche_id,
						sequence_number,
						title,
						objective,
						scope_json,
						dependencies_json,
						status,
						verification_profile,
						delivery_manifest_id,
						selection_rationale
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						validated.programId,
						tranche.trancheId,
						tranche.sequence,
						tranche.title,
						tranche.objective,
						JSON.stringify(tranche.scope),
						JSON.stringify(tranche.dependencies),
						tranche.status,
						tranche.verificationProfile,
						tranche.deliveryManifestId,
						tranche.selectionRationale,
					],
				);
			}
		});
	} finally {
		db.close();
	}
}
