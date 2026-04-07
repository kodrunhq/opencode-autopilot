import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir } from "../utils/fs-helpers";
import type { Phase } from "./types";

const LEGACY_RUN_ID = "legacy-run";

function isRunScoped(runId: string | undefined): runId is string {
	return runId !== undefined && runId !== LEGACY_RUN_ID;
}

export function getPhaseDir(artifactDir: string, phase: Phase, runId?: string): string {
	if (isRunScoped(runId)) {
		return join(artifactDir, "phases", runId, phase);
	}

	return join(artifactDir, "phases", phase);
}

export async function ensurePhaseDir(
	artifactDir: string,
	phase: Phase,
	runId?: string,
): Promise<string> {
	const dir = getPhaseDir(artifactDir, phase, runId);
	await ensureDir(dir);
	return dir;
}

/**
 * Returns the absolute path to a phase artifact.
 * This is the canonical path used in both handler file-existence checks
 * AND dispatch prompts, ensuring agents write to the location handlers verify.
 */
export function getArtifactRef(
	artifactDir: string,
	phase: Phase,
	filename: string,
	runId?: string,
): string {
	return join(getPhaseDir(artifactDir, phase, runId), filename);
}

export async function listRuns(artifactDir: string): Promise<readonly string[]> {
	try {
		const phasesDir = join(artifactDir, "phases");
		const entries = await readdir(phasesDir, { withFileTypes: true });

		return Object.freeze(
			entries
				.filter((entry) => entry.isDirectory() && entry.name.startsWith("run_"))
				.map((entry) => entry.name)
				.sort(),
		);
	} catch {
		return Object.freeze([]);
	}
}

export const PHASE_ARTIFACTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
	RECON: Object.freeze(["report.md"]),
	CHALLENGE: Object.freeze(["brief.md"]),
	ARCHITECT: Object.freeze(["design.md"]),
	EXPLORE: Object.freeze([]),
	PLAN: Object.freeze(["tasks.json", "tasks.md"]),
	BUILD: Object.freeze([]),
	SHIP: Object.freeze(["walkthrough.md", "decisions.md", "changelog.md"]),
	RETROSPECTIVE: Object.freeze(["lessons.json"]),
});
