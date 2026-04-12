import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openProjectKernelDb } from "../../src/kernel/database";
import {
	loadLatestProgramRunFromKernel,
	planProgramRunFromRequest,
	saveProgramRunToKernel,
} from "../../src/program";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "program-repository-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("program repository", () => {
	test("round-trips ProgramRun persistence through the kernel", () => {
		const program = planProgramRunFromRequest(
			["Remediation program:", "1. Persist program state.", "2. Continue automatically."].join(
				"\n",
			),
			"normal",
		);
		if (!program) {
			throw new Error("Expected program planning to produce a multi-tranche run");
		}

		saveProgramRunToKernel(tempDir, program);

		const loaded = loadLatestProgramRunFromKernel(tempDir);
		expect(loaded).toEqual(program);

		const db = openProjectKernelDb(tempDir, { readonly: true });
		try {
			const runRows = db.query("SELECT program_id, status FROM program_runs").all() as Array<{
				program_id: string;
				status: string;
			}>;
			const trancheRows = db
				.query("SELECT tranche_id, status FROM program_tranches ORDER BY sequence_number ASC")
				.all() as Array<{ tranche_id: string; status: string }>;

			expect(runRows).toHaveLength(1);
			expect(runRows[0]?.program_id).toBe(program.programId);
			expect(runRows[0]?.status).toBe("ACTIVE");
			expect(trancheRows).toHaveLength(program.tranches.length);
			expect(trancheRows[0]?.status).toBe("IN_PROGRESS");
		} finally {
			db.close();
		}
	});
});
