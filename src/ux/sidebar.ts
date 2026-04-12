import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { shouldCreatePr } from "../orchestrator/handlers/branch-pr";
import {
	getActiveTasks,
	getPhaseProgressString,
	getPipelineBlockedReason,
	getRemainingTaskBacklog,
} from "../orchestrator/progress";
import { phaseSchema, pipelineStateSchema, taskSchema } from "../orchestrator/schemas";
import { isPassingProgramOracleSignoff } from "../orchestrator/signoff";
import { loadStateSync } from "../orchestrator/state";
import type { PipelineState, PipelineVerificationStatus, Task } from "../orchestrator/types";
import { loadProgramRunFromKernel, type TrancheStatus } from "../program";
import { trancheStatusSchema } from "../program/schemas";
import type { ProgramRun, Tranche } from "../program/types";
import { getProjectArtifactDir } from "../utils/paths";

const SIDEBAR_NOT_STARTED = "Not started";

export const sidebarTaskSchema = z.object({
	id: z.number().int().positive(),
	title: z.string().max(2048),
	status: taskSchema.shape.status,
	wave: z.number().int().positive().nullable(),
	active: z.boolean(),
});

export const sidebarTrancheSchema = z.object({
	trancheId: z.string().max(128),
	sequence: z.number().int().positive(),
	title: z.string().max(512),
	objective: z.string().max(4096),
	status: trancheStatusSchema,
	isCurrent: z.boolean(),
});

export const sidebarReviewProjectionSchema = z.object({
	status: z.enum(["IDLE", "PLANNED", "RUNNING", "PASSED", "BLOCKED", "FAILED"]),
	verdict: z.string().max(128).nullable(),
	summary: z.string().max(4096).nullable(),
	blockedReason: z.string().max(4096).nullable(),
	completedReviewers: z.number().int().min(0),
	totalReviewers: z.number().int().min(0),
});

export const sidebarOracleProjectionSchema = z.object({
	status: z.enum(["NOT_STARTED", "PENDING", "PASSED", "BLOCKED"]),
	scope: z.enum(["TRANCHE", "PROGRAM"]).nullable(),
	verdict: z.string().max(128).nullable(),
	summary: z.string().max(4096).nullable(),
	blockedReason: z.string().max(4096).nullable(),
});

export const sidebarVerificationProjectionSchema = z.object({
	status: z.enum(["NOT_STARTED", "PASSED", "FAILED", "BLOCKED", "PENDING"]),
	summary: z.string().max(4096).nullable(),
	localStatus: z.string().max(64).nullable(),
	localSummary: z.string().max(4096).nullable(),
	ciStatus: z.string().max(64).nullable(),
	ciSummary: z.string().max(4096).nullable(),
});

export const sidebarShipProjectionSchema = z.object({
	status: z.enum([
		"NOT_STARTED",
		"RUNNING",
		"READY_TO_PR",
		"PR_OPEN",
		"WAITING_FOR_CI",
		"BLOCKED",
		"SHIPPED",
		"COMPLETED",
	]),
	summary: z.string().max(4096).nullable(),
});

export const sidebarBranchProjectionSchema = z.object({
	branch: z.string().max(256).nullable(),
	baseBranch: z.string().max(256).nullable(),
	prNumber: z.number().int().positive().nullable(),
	prUrl: z.string().max(1024).nullable(),
	ciStatus: z.string().max(64).nullable(),
	ciSummary: z.string().max(4096).nullable(),
});

export const sidebarBacklogProjectionSchema = z.object({
	tasks: z.array(sidebarTaskSchema).default([]),
	tranches: z.array(sidebarTrancheSchema).default([]),
	summary: z.string().max(4096),
});

export const sidebarStateSchema = z.object({
	programObjective: z.string().max(16000),
	programStatus: z.enum(["ACTIVE", "COMPLETED", "BLOCKED", "ABANDONED", "SINGLE_RUN"]),
	currentTranche: sidebarTrancheSchema.nullable(),
	tranches: z.array(sidebarTrancheSchema),
	phase: phaseSchema.nullable(),
	phaseProgress: z.string().max(4096),
	activeTasks: z.array(sidebarTaskSchema),
	currentWave: z.number().int().positive().nullable(),
	reviewStatus: sidebarReviewProjectionSchema,
	oracleStatus: sidebarOracleProjectionSchema,
	verificationStatus: sidebarVerificationProjectionSchema,
	shipStatus: sidebarShipProjectionSchema,
	branchStatus: sidebarBranchProjectionSchema,
	blockedReason: z.string().max(4096).nullable(),
	remainingBacklog: sidebarBacklogProjectionSchema,
});

export type SidebarTask = z.infer<typeof sidebarTaskSchema>;
export type SidebarTranche = z.infer<typeof sidebarTrancheSchema>;
export type SidebarReviewProjection = z.infer<typeof sidebarReviewProjectionSchema>;
export type SidebarOracleProjection = z.infer<typeof sidebarOracleProjectionSchema>;
export type SidebarVerificationProjection = z.infer<typeof sidebarVerificationProjectionSchema>;
export type SidebarShipProjection = z.infer<typeof sidebarShipProjectionSchema>;
export type SidebarBranchProjection = z.infer<typeof sidebarBranchProjectionSchema>;
export type SidebarBacklogProjection = z.infer<typeof sidebarBacklogProjectionSchema>;
export type SidebarState = z.infer<typeof sidebarStateSchema>;

export interface SidebarSlotContext {
	readonly theme?: {
		readonly current?: Readonly<Record<string, unknown>>;
	};
}

export interface SidebarSlotProps {
	readonly session_id: string;
}

export interface SidebarSlotPlugin {
	readonly order?: number;
	readonly slots: {
		readonly sidebar_content?: (ctx: SidebarSlotContext, props: SidebarSlotProps) => unknown;
	};
}

export interface SidebarTuiApi {
	readonly state: {
		readonly path: {
			readonly worktree?: string;
			readonly directory?: string;
		};
	};
	readonly slots: {
		register: (plugin: SidebarSlotPlugin) => string;
	};
}

export type SidebarTuiPlugin = (
	api: SidebarTuiApi,
	options?: Record<string, unknown>,
	meta?: unknown,
) => Promise<void>;

function collapseWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function toTaskProjection(task: Readonly<Task>, activeTaskIds: ReadonlySet<number>): SidebarTask {
	return sidebarTaskSchema.parse({
		id: task.id,
		title: task.title,
		status: task.status,
		wave: Number.isFinite(task.wave) ? task.wave : null,
		active: activeTaskIds.has(task.id),
	});
}

function mapSingleRunTrancheStatus(state: Readonly<PipelineState>): TrancheStatus {
	if (state.status === "COMPLETED") {
		return "COMPLETED";
	}

	if (state.status === "FAILED" || state.status === "INTERRUPTED") {
		return "BLOCKED";
	}

	return "IN_PROGRESS";
}

function createSyntheticTranche(state: Readonly<PipelineState>): SidebarTranche {
	return sidebarTrancheSchema.parse({
		trancheId: state.programContext?.trancheId ?? state.runId,
		sequence: state.programContext?.trancheIndex ?? 1,
		title: state.programContext?.trancheTitle ?? "Single tranche delivery",
		objective: state.idea,
		status: mapSingleRunTrancheStatus(state),
		isCurrent: true,
	});
}

function toTrancheProjection(
	tranche: Readonly<Tranche>,
	currentTrancheId: string | null,
): SidebarTranche {
	return sidebarTrancheSchema.parse({
		trancheId: tranche.trancheId,
		sequence: tranche.sequence,
		title: tranche.title,
		objective: tranche.objective,
		status: tranche.status,
		isCurrent: tranche.trancheId === currentTrancheId,
	});
}

function buildTrancheList(
	state: Readonly<PipelineState>,
	program: Readonly<ProgramRun> | null,
): readonly SidebarTranche[] {
	if (program === null) {
		return Object.freeze([createSyntheticTranche(state)]);
	}

	const currentTrancheId = state.programContext?.trancheId ?? program.currentTrancheId;
	return Object.freeze(
		program.tranches.map((tranche) => toTrancheProjection(tranche, currentTrancheId)),
	);
}

function buildReviewProjection(state: Readonly<PipelineState>): SidebarReviewProjection {
	const reviewStatus = state.reviewStatus;
	const completedReviewers = reviewStatus.reviewers.filter(
		(reviewer) => reviewer.status === "COMPLETED",
	).length;
	const totalReviewers = reviewStatus.reviewers.length;
	const effectiveStatus =
		reviewStatus.status === "IDLE" && state.buildProgress.reviewPending
			? "RUNNING"
			: reviewStatus.status;
	const summary =
		reviewStatus.summary ??
		(effectiveStatus === "RUNNING"
			? "Structured review is running for the current wave."
			: effectiveStatus === "PASSED"
				? "Structured review passed."
				: effectiveStatus === "BLOCKED"
					? (reviewStatus.blockedReason ?? "Structured review is blocking shipment.")
					: SIDEBAR_NOT_STARTED);

	return sidebarReviewProjectionSchema.parse({
		status: effectiveStatus,
		verdict: reviewStatus.verdict,
		summary,
		blockedReason: reviewStatus.blockedReason,
		completedReviewers,
		totalReviewers,
	});
}

function buildOracleProjection(state: Readonly<PipelineState>): SidebarOracleProjection {
	const programSignoff = state.oracleSignoffs.program;
	const trancheSignoff = state.oracleSignoffs.tranche;

	if (programSignoff !== null) {
		const isPending = programSignoff.verdict === "PENDING";
		const isPassing = isPassingProgramOracleSignoff(programSignoff);
		return sidebarOracleProjectionSchema.parse({
			status: isPassing ? "PASSED" : isPending ? "PENDING" : "BLOCKED",
			scope: "PROGRAM",
			verdict: programSignoff.verdict,
			summary: programSignoff.reasoning,
			blockedReason: isPassing || isPending ? null : programSignoff.reasoning,
		});
	}

	if (state.buildProgress.oraclePending) {
		return sidebarOracleProjectionSchema.parse({
			status: "PENDING",
			scope: "TRANCHE",
			verdict: null,
			summary: "Awaiting tranche Oracle signoff.",
			blockedReason: null,
		});
	}

	if (trancheSignoff !== null) {
		const blockedReason =
			trancheSignoff.verdict === "FAIL"
				? trancheSignoff.blockingConditions.join("; ") || trancheSignoff.reasoning
				: null;
		return sidebarOracleProjectionSchema.parse({
			status: trancheSignoff.verdict === "FAIL" ? "BLOCKED" : "PASSED",
			scope: "TRANCHE",
			verdict: trancheSignoff.verdict,
			summary: trancheSignoff.reasoning,
			blockedReason,
		});
	}

	if (state.currentPhase === "SHIP") {
		return sidebarOracleProjectionSchema.parse({
			status: "BLOCKED",
			scope: "TRANCHE",
			verdict: null,
			summary: "Tranche Oracle signoff is required before shipping.",
			blockedReason: "Tranche Oracle signoff is required before shipping.",
		});
	}

	return sidebarOracleProjectionSchema.parse({
		status: "NOT_STARTED",
		scope: null,
		verdict: null,
		summary: SIDEBAR_NOT_STARTED,
		blockedReason: null,
	});
}

function buildVerificationProjection(
	verificationStatus: Readonly<PipelineVerificationStatus>,
): SidebarVerificationProjection {
	return sidebarVerificationProjectionSchema.parse({
		status: verificationStatus.status,
		summary: verificationStatus.summary ?? SIDEBAR_NOT_STARTED,
		localStatus: verificationStatus.localStatus,
		localSummary: verificationStatus.localSummary,
		ciStatus: verificationStatus.ciStatus,
		ciSummary: verificationStatus.ciSummary,
	});
}

function buildShipProjection(state: Readonly<PipelineState>): SidebarShipProjection {
	const shipPhase = state.phases.find((phase) => phase.name === "SHIP") ?? null;
	const branchLifecycle = state.branchLifecycle;
	const verificationStatus = state.verificationStatus;

	if (state.status === "COMPLETED") {
		return sidebarShipProjectionSchema.parse({
			status: "COMPLETED",
			summary: "The tranche pipeline completed successfully.",
		});
	}

	if (verificationStatus.status === "FAILED" || verificationStatus.status === "BLOCKED") {
		return sidebarShipProjectionSchema.parse({
			status: "BLOCKED",
			summary: verificationStatus.summary,
		});
	}

	if (verificationStatus.status === "PENDING") {
		return sidebarShipProjectionSchema.parse({
			status: "WAITING_FOR_CI",
			summary: verificationStatus.summary,
		});
	}

	if (shipPhase?.status === "DONE") {
		return sidebarShipProjectionSchema.parse({
			status: "SHIPPED",
			summary:
				verificationStatus.status === "PASSED"
					? "Tranche shipped and verification passed."
					: "Tranche shipped.",
		});
	}

	if (state.currentPhase === "SHIP") {
		const prNumber = branchLifecycle?.prNumber;
		if (prNumber != null) {
			return sidebarShipProjectionSchema.parse({
				status: "PR_OPEN",
				summary: `Pull request #${String(prNumber)} is open.`,
			});
		}

		if (branchLifecycle && shouldCreatePr(branchLifecycle)) {
			return sidebarShipProjectionSchema.parse({
				status: "READY_TO_PR",
				summary: "Ready to create a pull request for the shipped tranche.",
			});
		}

		return sidebarShipProjectionSchema.parse({
			status: "RUNNING",
			summary: "Shipping is in progress.",
		});
	}

	return sidebarShipProjectionSchema.parse({
		status: "NOT_STARTED",
		summary: SIDEBAR_NOT_STARTED,
	});
}

function buildBranchProjection(state: Readonly<PipelineState>): SidebarBranchProjection {
	return sidebarBranchProjectionSchema.parse({
		branch: state.branchLifecycle?.currentBranch ?? null,
		baseBranch: state.branchLifecycle?.baseBranch ?? null,
		prNumber: state.branchLifecycle?.prNumber ?? null,
		prUrl: state.branchLifecycle?.prUrl ?? null,
		ciStatus: state.verificationStatus.ciStatus,
		ciSummary: state.verificationStatus.ciSummary,
	});
}

function buildBacklogProjection(
	state: Readonly<PipelineState>,
	tranches: readonly SidebarTranche[],
): SidebarBacklogProjection {
	const activeTaskIds = new Set(getActiveTasks(state).map((task) => task.id));
	const remainingTasks = getRemainingTaskBacklog(state).map((task) =>
		toTaskProjection(task, activeTaskIds),
	);
	const currentSequence =
		state.programContext?.trancheIndex ??
		tranches.find((tranche) => tranche.isCurrent)?.sequence ??
		1;
	const remainingTranches = tranches.filter((tranche) => tranche.sequence > currentSequence);
	const summaryParts: string[] = [];

	if (remainingTasks.length > 0) {
		summaryParts.push(`${remainingTasks.length} task(s) remain in the current tranche`);
	}

	if (remainingTranches.length > 0) {
		summaryParts.push(`${remainingTranches.length} future tranche(s) remain in backlog`);
	}

	if (summaryParts.length === 0) {
		summaryParts.push("No remaining backlog recorded.");
	}

	return sidebarBacklogProjectionSchema.parse({
		tasks: remainingTasks,
		tranches: remainingTranches,
		summary: summaryParts.join(". "),
	});
}

function buildProgramObjective(
	state: Readonly<PipelineState>,
	program: Readonly<ProgramRun> | null,
): string {
	return program?.originatingRequest ?? state.programContext?.originatingRequest ?? state.idea;
}

function buildProgramStatus(program: Readonly<ProgramRun> | null): SidebarState["programStatus"] {
	if (program === null) {
		return "SINGLE_RUN";
	}

	return program.status;
}

export function buildSidebarState(input: {
	readonly state: Readonly<PipelineState>;
	readonly program?: Readonly<ProgramRun> | null;
}): SidebarState {
	const program = input.program ?? null;
	const tranches = buildTrancheList(input.state, program);
	const activeTasks = getActiveTasks(input.state);
	const activeTaskIds = new Set(activeTasks.map((task) => task.id));
	const currentTrancheId =
		input.state.programContext?.trancheId ?? program?.currentTrancheId ?? null;
	const currentTranche =
		tranches.find((tranche) => tranche.trancheId === currentTrancheId) ?? tranches[0] ?? null;

	return sidebarStateSchema.parse({
		programObjective: buildProgramObjective(input.state, program),
		programStatus: buildProgramStatus(program),
		currentTranche,
		tranches,
		phase: input.state.currentPhase,
		phaseProgress: getPhaseProgressString(input.state),
		activeTasks: activeTasks.map((task) => toTaskProjection(task, activeTaskIds)),
		currentWave: input.state.buildProgress.currentWave,
		reviewStatus: buildReviewProjection(input.state),
		oracleStatus: buildOracleProjection(input.state),
		verificationStatus: buildVerificationProjection(input.state.verificationStatus),
		shipStatus: buildShipProjection(input.state),
		branchStatus: buildBranchProjection(input.state),
		blockedReason: getPipelineBlockedReason(input.state) ?? program?.blockedReason ?? null,
		remainingBacklog: buildBacklogProjection(input.state, tranches),
	});
}

function loadProgramForState(
	artifactDir: string,
	state: Readonly<PipelineState>,
): ProgramRun | null {
	const programId = state.programContext?.programId;
	if (!programId) {
		return null;
	}

	return loadProgramRunFromKernel(artifactDir, programId);
}

function loadLegacySidebarStateSync(artifactDir: string): PipelineState | null {
	const statePath = join(artifactDir, "state.json");
	try {
		const raw = readFileSync(statePath, "utf-8");
		return pipelineStateSchema.parse(JSON.parse(raw));
	} catch {
		return null;
	}
}

export function loadSidebarStateForArtifactDir(artifactDir: string): SidebarState | null {
	const state = loadStateSync(artifactDir) ?? loadLegacySidebarStateSync(artifactDir);
	if (state === null) {
		return null;
	}

	return buildSidebarState({
		state,
		program: loadProgramForState(artifactDir, state),
	});
}

export function loadSidebarStateForProject(projectRoot: string): SidebarState | null {
	return loadSidebarStateForArtifactDir(getProjectArtifactDir(projectRoot));
}

function renderTaskLine(task: Readonly<SidebarTask>): string {
	const wave = task.wave === null ? "" : ` · wave ${String(task.wave)}`;
	return `- #${String(task.id)} [${task.status}] ${task.title}${wave}`;
}

function renderTrancheLine(tranche: Readonly<SidebarTranche>): string {
	const currentMarker = tranche.isCurrent ? " ← current" : "";
	return `${String(tranche.sequence)}. [${tranche.status}] ${tranche.title}${currentMarker}`;
}

function renderMaybeLine(label: string, value: string | number | null | undefined): string {
	if (value === null || value === undefined || value === "") {
		return `${label}: ${SIDEBAR_NOT_STARTED}`;
	}
	return `${label}: ${String(value)}`;
}

export function renderSidebarText(sidebarState: Readonly<SidebarState>): string {
	const lines: string[] = [
		"Autopilot plan",
		renderMaybeLine("Objective", collapseWhitespace(sidebarState.programObjective)),
		renderMaybeLine(
			"Current tranche",
			sidebarState.currentTranche
				? `#${String(sidebarState.currentTranche.sequence)} [${sidebarState.currentTranche.status}] ${sidebarState.currentTranche.title}`
				: null,
		),
		"Tranches:",
		...(sidebarState.tranches.length > 0
			? sidebarState.tranches.map(renderTrancheLine)
			: ["- No tranches recorded."]),
		renderMaybeLine("Phase", sidebarState.phase),
		renderMaybeLine("Progress", sidebarState.phaseProgress),
		renderMaybeLine("Wave", sidebarState.currentWave),
		"Active tasks:",
		...(sidebarState.activeTasks.length > 0
			? sidebarState.activeTasks.map(renderTaskLine)
			: ["- No active tasks."]),
		renderMaybeLine(
			"Review",
			`${sidebarState.reviewStatus.status} · ${sidebarState.reviewStatus.completedReviewers}/${sidebarState.reviewStatus.totalReviewers} reviewers · ${sidebarState.reviewStatus.summary ?? SIDEBAR_NOT_STARTED}`,
		),
		renderMaybeLine(
			"Oracle",
			`${sidebarState.oracleStatus.status}${sidebarState.oracleStatus.verdict ? ` (${sidebarState.oracleStatus.verdict})` : ""} · ${sidebarState.oracleStatus.summary ?? SIDEBAR_NOT_STARTED}`,
		),
		renderMaybeLine(
			"Verification",
			`${sidebarState.verificationStatus.status} · ${sidebarState.verificationStatus.summary ?? SIDEBAR_NOT_STARTED}`,
		),
		renderMaybeLine(
			"Ship",
			`${sidebarState.shipStatus.status} · ${sidebarState.shipStatus.summary ?? SIDEBAR_NOT_STARTED}`,
		),
		renderMaybeLine("Branch", sidebarState.branchStatus.branch),
		renderMaybeLine("PR", sidebarState.branchStatus.prNumber),
		renderMaybeLine(
			"CI",
			sidebarState.branchStatus.ciStatus
				? `${sidebarState.branchStatus.ciStatus} · ${sidebarState.branchStatus.ciSummary ?? SIDEBAR_NOT_STARTED}`
				: null,
		),
		renderMaybeLine("Blocked", sidebarState.blockedReason),
		renderMaybeLine("Backlog", sidebarState.remainingBacklog.summary),
		"Remaining tasks:",
		...(sidebarState.remainingBacklog.tasks.length > 0
			? sidebarState.remainingBacklog.tasks.map(renderTaskLine)
			: ["- No remaining tasks."]),
		"Remaining tranches:",
		...(sidebarState.remainingBacklog.tranches.length > 0
			? sidebarState.remainingBacklog.tranches.map(renderTrancheLine)
			: ["- No remaining tranches."]),
	];

	return lines.join("\n");
}

function resolveSidebarProjectRoot(api: Readonly<SidebarTuiApi>): string | null {
	const candidate = api.state.path.worktree || api.state.path.directory;
	if (!candidate || candidate.trim().length === 0) {
		return null;
	}
	return candidate;
}

export function createSidebarTuiPlugin(options?: { readonly order?: number }): SidebarTuiPlugin {
	const order = options?.order ?? 50;

	return async (api) => {
		api.slots.register({
			order,
			slots: {
				sidebar_content(_ctx, _props) {
					const projectRoot = resolveSidebarProjectRoot(api);
					if (!projectRoot) {
						return null;
					}

					const sidebarState = loadSidebarStateForProject(projectRoot);
					if (sidebarState === null) {
						return null;
					}

					return renderSidebarText(sidebarState);
				},
			},
		});
	};
}
