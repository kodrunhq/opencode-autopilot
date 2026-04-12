import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadLatestPipelineStateFromKernel, savePipelineStateToKernel } from "../kernel/repository";
import { KERNEL_STATE_CONFLICT_CODE } from "../kernel/types";
import { getLogger } from "../logging/domains";
import { ensureDir, isEnoentError } from "../utils/fs-helpers";
import { assertProjectArtifactOwnership } from "../utils/paths";
import { assertStateInvariants } from "./contracts/invariants";
import { PHASES, pipelineStateSchema } from "./schemas";
import type { PipelineState, ProgramPipelineContext } from "./types";

const STATE_FILE = "state.json";
let legacyStateMirrorWarned = false;
const logger = getLogger("orchestrator", "state");

function generateRunId(): string {
	return `run_${randomBytes(8).toString("hex")}`;
}

export function createInitialState(
	idea: string,
	options?: { readonly programContext?: ProgramPipelineContext | null },
): PipelineState {
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
			phaseNumber: i + 1,
			status: i === 0 ? "IN_PROGRESS" : "PENDING",
		})),
		decisions: [],
		confidence: [],
		tasks: [],
		arenaConfidence: null,
		exploreTriggered: false,
		pendingDispatches: [],
		processedResultIds: [],
		programContext: options?.programContext ?? null,
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

function loadLegacyStateSync(artifactDir: string): PipelineState | null {
	const statePath = join(artifactDir, STATE_FILE);
	try {
		const raw = readFileSync(statePath, "utf-8");
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
	const validatedArtifactDir = assertProjectArtifactOwnership(artifactDir);
	const kernelState = loadLatestPipelineStateFromKernel(validatedArtifactDir);
	if (kernelState !== null) {
		return kernelState;
	}

	const legacyState = await loadLegacyState(validatedArtifactDir);
	if (legacyState === null) {
		return null;
	}

	savePipelineStateToKernel(validatedArtifactDir, legacyState);
	return legacyState;
}

export function loadStateSync(artifactDir: string): PipelineState | null {
	const validatedArtifactDir = assertProjectArtifactOwnership(artifactDir);
	const kernelState = loadLatestPipelineStateFromKernel(validatedArtifactDir);
	if (kernelState !== null) {
		return kernelState;
	}

	const legacyState = loadLegacyStateSync(validatedArtifactDir);
	if (legacyState === null) {
		return null;
	}

	savePipelineStateToKernel(validatedArtifactDir, legacyState);
	return legacyState;
}

export async function saveState(
	state: PipelineState,
	artifactDir: string,
	expectedRevision?: number,
): Promise<void> {
	const validatedArtifactDir = assertProjectArtifactOwnership(artifactDir);
	const validated = pipelineStateSchema.parse(state);
	assertStateInvariants(validated);
	savePipelineStateToKernel(validatedArtifactDir, validated, expectedRevision);
	await syncLegacyStateMirror(validated, validatedArtifactDir);
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
	const validatedArtifactDir = assertProjectArtifactOwnership(artifactDir);
	const maxConflicts = options?.maxConflicts ?? 2;
	let currentState = state;

	for (let attempt = 0; ; attempt += 1) {
		const nextState = transform(currentState);
		if (nextState === currentState) {
			return currentState;
		}

		try {
			await saveState(nextState, validatedArtifactDir, currentState.stateRevision);
			return nextState;
		} catch (error: unknown) {
			if (!isStateConflictError(error) || attempt >= maxConflicts) {
				throw error;
			}

			const latestState = await loadState(validatedArtifactDir);
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
