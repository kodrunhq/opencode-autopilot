import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { assertStateInvariants } from "./contracts/invariants";
import { PHASES, pipelineStateSchema } from "./schemas";
import type { PipelineState } from "./types";

const STATE_FILE = "state.json";

function generateRunId(): string {
	return `run_${randomBytes(8).toString("hex")}`;
}

export function createInitialState(idea: string): PipelineState {
	const now = new Date().toISOString();
	return pipelineStateSchema.parse({
		schemaVersion: 2,
		status: "IN_PROGRESS",
		runId: generateRunId(),
		stateRevision: 0,
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
		pendingDispatches: [],
		processedResultIds: [],
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

export async function saveState(
	state: PipelineState,
	artifactDir: string,
	expectedRevision?: number,
): Promise<void> {
	if (typeof expectedRevision === "number") {
		const current = await loadState(artifactDir);
		const currentRevision = current?.stateRevision ?? -1;
		if (currentRevision !== expectedRevision) {
			throw new Error(
				`E_STATE_CONFLICT: expected stateRevision ${expectedRevision}, found ${currentRevision}`,
			);
		}
	}

	const validated = pipelineStateSchema.parse(state);
	assertStateInvariants(validated);
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
	const now = new Date().toISOString();
	const merged = {
		...current,
		...updates,
		stateRevision: current.stateRevision + 1,
		lastUpdatedAt: now,
	};

	if (merged.status === "COMPLETED") {
		merged.currentPhase = null;
		merged.phases = merged.phases.map((phase) => {
			if (phase.status === "IN_PROGRESS") {
				return {
					...phase,
					status: "DONE" as const,
					completedAt: phase.completedAt ?? now,
				};
			}
			return phase;
		});
	}

	const validated = pipelineStateSchema.parse(merged);
	assertStateInvariants(validated);
	return validated;
}

export function appendDecision(
	current: Readonly<PipelineState>,
	decision: { phase: string; agent: string; decision: string; rationale: string },
): PipelineState {
	return patchState(current, {
		decisions: [
			...current.decisions,
			{
				...decision,
				timestamp: new Date().toISOString(),
			},
		],
	});
}
