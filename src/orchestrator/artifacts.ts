import { join } from "node:path";
import { ensureDir } from "../utils/fs-helpers";
import type { Phase } from "./types";

export function getPhaseDir(artifactDir: string, phase: Phase): string {
	return join(artifactDir, "phases", phase);
}

export async function ensurePhaseDir(artifactDir: string, phase: Phase): Promise<string> {
	const dir = getPhaseDir(artifactDir, phase);
	await ensureDir(dir);
	return dir;
}

export function getArtifactRef(phase: Phase, filename: string): string {
	return `phases/${phase}/${filename}`;
}

export const PHASE_ARTIFACTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
	RECON: Object.freeze(["report.md"]),
	CHALLENGE: Object.freeze(["brief.md"]),
	ARCHITECT: Object.freeze(["design.md"]),
	EXPLORE: Object.freeze([]),
	PLAN: Object.freeze(["tasks.md"]),
	BUILD: Object.freeze([]),
	SHIP: Object.freeze(["walkthrough.md", "decisions.md", "changelog.md"]),
	RETROSPECTIVE: Object.freeze(["lessons.md"]),
});
