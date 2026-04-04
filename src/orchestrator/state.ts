import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { PHASES, pipelineStateSchema } from "./schemas";
import type { PipelineState } from "./types";

const STATE_FILE = "state.json";

export function createInitialState(idea: string): PipelineState {
	const now = new Date().toISOString();
	return pipelineStateSchema.parse({
		schemaVersion: 2,
		status: "IN_PROGRESS",
		idea,
		currentPhase: "RECON",
		startedAt: now,
		lastUpdatedAt: now,
		phases: PHASES.map((name, i) => ({
			name,
			status: i === 0 ? "IN_PROGRESS" : "PENDING",
		})),
		decisions: [],
		confidence: [],
		tasks: [],
		arenaConfidence: null,
		exploreTriggered: false,
	});
}

export async function loadState(artifactDir: string): Promise<PipelineState | null> {
	const statePath = join(artifactDir, STATE_FILE);
	try {
		const raw = await readFile(statePath, "utf-8");
		const parsed = JSON.parse(raw);
		return pipelineStateSchema.parse(parsed);
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return null;
		}
		throw error;
	}
}

export async function saveState(state: PipelineState, artifactDir: string): Promise<void> {
	const validated = pipelineStateSchema.parse(state);
	await ensureDir(artifactDir);
	const statePath = join(artifactDir, STATE_FILE);
	const tmpPath = `${statePath}.tmp.${randomBytes(8).toString("hex")}`;
	await writeFile(tmpPath, JSON.stringify(validated, null, 2), "utf-8");
	await rename(tmpPath, statePath);
}

export function patchState(
	current: Readonly<PipelineState>,
	updates: Partial<PipelineState>,
): PipelineState {
	const merged = {
		...current,
		...updates,
		lastUpdatedAt: new Date().toISOString(),
	};
	return pipelineStateSchema.parse(merged);
}

export function appendDecision(
	current: Readonly<PipelineState>,
	decision: { phase: string; agent: string; decision: string; rationale: string },
): PipelineState {
	return {
		...current,
		decisions: [
			...current.decisions,
			{
				...decision,
				timestamp: new Date().toISOString(),
			},
		],
		lastUpdatedAt: new Date().toISOString(),
	};
}
