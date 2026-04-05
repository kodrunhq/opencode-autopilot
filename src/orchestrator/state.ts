import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadLatestPipelineStateFromKernel, savePipelineStateToKernel } from "../kernel/repository";
import { KERNEL_STATE_CONFLICT_CODE } from "../kernel/types";
import { getLogger } from "../logging/domains";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { assertStateInvariants } from "./contracts/invariants";
import { PHASES, pipelineStateSchema } from "./schemas";
import type { PipelineState } from "./types";

const STATE_FILE = "state.json";
let legacyStateMirrorWarned = false;
const logger = getLogger("orchestrator", "state");

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

async function loadLegacyState(artifactDir: string): Promise<PipelineState | null> {
	const statePath = join(artifactDir, STATE_FILE);
	try {
		const raw = await readFile(statePath, "utf-8");
		const parsed = JSON.parse(raw);
		const validated = pipelineStateSchema.parse(parsed);
		assertStateInvariants(validated);
		return validated;
	} catch (error: unknown) {
		if (isEnoentError(error)) {
			return null;
		}
		throw error;
	}
}

async function writeLegacyStateMirror(state: PipelineState, artifactDir: string): Promise<void> {
	await ensureDir(artifactDir);
	const statePath = join(artifactDir, STATE_FILE);
	const tmpPath = `${statePath}.tmp.${randomBytes(8).toString("hex")}`;
	await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf-8");
	await rename(tmpPath, statePath);
}

async function syncLegacyStateMirror(state: PipelineState, artifactDir: string): Promise<void> {
	try {
		await writeLegacyStateMirror(state, artifactDir);
	} catch (error: unknown) {
		if (!legacyStateMirrorWarned) {
			legacyStateMirrorWarned = true;
			logger.warn("state.json mirror write failed", {
				operation: "legacy_state_mirror",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}

export async function loadState(artifactDir: string): Promise<PipelineState | null> {
	const kernelState = loadLatestPipelineStateFromKernel(artifactDir);
	if (kernelState !== null) {
		return kernelState;
	}

	const legacyState = await loadLegacyState(artifactDir);
	if (legacyState === null) {
		return null;
	}

	savePipelineStateToKernel(artifactDir, legacyState);
	return legacyState;
}

export async function saveState(
	state: PipelineState,
	artifactDir: string,
	expectedRevision?: number,
): Promise<void> {
	const validated = pipelineStateSchema.parse(state);
	assertStateInvariants(validated);
	savePipelineStateToKernel(artifactDir, validated, expectedRevision);
	await syncLegacyStateMirror(validated, artifactDir);
}

export function isStateConflictError(error: unknown): boolean {
	return error instanceof Error && error.message.startsWith(`${KERNEL_STATE_CONFLICT_CODE}:`);
}

export async function updatePersistedState(
	artifactDir: string,
	state: Readonly<PipelineState>,
	transform: (current: Readonly<PipelineState>) => PipelineState,
	options?: { readonly maxConflicts?: number },
): Promise<PipelineState> {
	const maxConflicts = options?.maxConflicts ?? 2;
	let currentState = state;

	for (let attempt = 0; ; attempt += 1) {
		const nextState = transform(currentState);
		if (nextState === currentState) {
			return currentState;
		}

		try {
			await saveState(nextState, artifactDir, currentState.stateRevision);
			return nextState;
		} catch (error: unknown) {
			if (!isStateConflictError(error) || attempt >= maxConflicts) {
				throw error;
			}

			const latestState = await loadState(artifactDir);
			if (latestState === null) {
				throw new Error(`${KERNEL_STATE_CONFLICT_CODE}: state disappeared during update`);
			}
			currentState = latestState;
		}
	}
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
