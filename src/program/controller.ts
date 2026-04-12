import { randomBytes } from "node:crypto";
import type { ExecutionMode } from "../config";
import { assessBroadRequest, groupWorkItemsIntoTranches } from "./heuristics";
import { programRunSchema, trancheSchema } from "./schemas";
import type { ProgramMode, ProgramRun, Tranche } from "./types";

const DEFAULT_PROGRAM_MODE: ProgramMode = "autonomous";

function createProgramId(): string {
	return `program_${randomBytes(8).toString("hex")}`;
}

function createTrancheId(index: number): string {
	return `tranche_${String(index + 1).padStart(2, "0")}`;
}

function truncate(text: string, limit: number): string {
	return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

function buildTrancheTitle(scope: readonly string[]): string {
	return truncate(scope[0] ?? "Delivery tranche", 96);
}

function buildTrancheObjective(scope: readonly string[]): string {
	if (scope.length <= 1) {
		return scope[0] ?? "Complete the current delivery tranche.";
	}
	return truncate(scope.join("; "), 512);
}

function buildSelectionRationale(index: number, total: number): string {
	if (index === 0) {
		return total === 1
			? "Selected automatically because the request fits a single autonomous tranche."
			: "Selected automatically because it is the first independent tranche and unblocks the remaining backlog.";
	}
	return `Selected automatically as tranche ${index + 1}/${total} after earlier tranche dependencies are satisfied.`;
}

function resolveProgramMode(options?: {
	readonly executionMode?: ExecutionMode;
	readonly mode?: ProgramMode;
}): ProgramMode {
	if (options?.executionMode === "background") {
		return "autonomous";
	}

	if (options?.executionMode === "foreground") {
		return "interactive";
	}

	return options?.mode ?? DEFAULT_PROGRAM_MODE;
}

function createTranches(
	workItems: readonly string[],
	verificationProfile: string,
): readonly Tranche[] {
	const groups = groupWorkItemsIntoTranches(workItems);
	return Object.freeze(
		groups.map((scope, index) => {
			const trancheId = createTrancheId(index);
			return trancheSchema.parse({
				trancheId,
				sequence: index + 1,
				title: buildTrancheTitle(scope),
				objective: buildTrancheObjective(scope),
				scope,
				dependencies: index === 0 ? [] : [createTrancheId(index - 1)],
				status: index === 0 ? "IN_PROGRESS" : "PENDING",
				verificationProfile,
				deliveryManifestId: null,
				selectionRationale: buildSelectionRationale(index, groups.length),
			});
		}),
	);
}

function updateTranche(
	program: Readonly<{ tranches: readonly Tranche[] }>,
	trancheId: string,
	transform: (tranche: Readonly<Tranche>) => Tranche,
): readonly Tranche[] {
	return Object.freeze(
		program.tranches.map((tranche) =>
			tranche.trancheId === trancheId ? transform(tranche) : tranche,
		),
	);
}

function findNextPendingTranche(
	program: Readonly<ProgramRun>,
	currentSequence: number,
): Tranche | null {
	return (
		program.tranches.find(
			(tranche) => tranche.sequence > currentSequence && tranche.status === "PENDING",
		) ?? null
	);
}

export function planProgramRunFromRequest(
	originatingRequest: string,
	verificationProfile: string,
	options?: {
		readonly now?: string;
		readonly executionMode?: ExecutionMode;
		readonly mode?: ProgramMode;
		readonly programId?: string;
	},
): ProgramRun | null {
	const assessment = assessBroadRequest(originatingRequest);
	if (!assessment.isBroad) {
		return null;
	}

	const createdAt = options?.now ?? new Date().toISOString();
	const tranches = createTranches(assessment.workItems, verificationProfile);

	return programRunSchema.parse({
		schemaVersion: 1,
		programId: options?.programId ?? createProgramId(),
		originatingRequest,
		mode: resolveProgramMode(options),
		createdAt,
		status: "ACTIVE",
		successCriteria: assessment.successCriteria,
		tranches,
		currentTrancheId: tranches[0]?.trancheId ?? null,
		finalOracleVerdict: null,
		blockedReason: null,
	});
}

export function getCurrentTranche(program: Readonly<ProgramRun>): Tranche | null {
	if (program.currentTrancheId === null) {
		return null;
	}
	return program.tranches.find((tranche) => tranche.trancheId === program.currentTrancheId) ?? null;
}

export function buildPipelineIdeaForTranche(
	program: Readonly<ProgramRun>,
	tranche: Readonly<Tranche>,
): string {
	const scopeLines = tranche.scope.slice(0, 6).map((item) => `- ${item}`);
	return [
		tranche.objective,
		"",
		`Program tranche ${tranche.sequence}/${program.tranches.length}: ${tranche.title}`,
		`Selection rationale: ${tranche.selectionRationale}`,
		"Execute only this tranche scope. The controller will automatically continue with later tranches.",
		scopeLines.length > 0 ? "Scope:" : "",
		...scopeLines,
	]
		.filter((line) => line.length > 0)
		.join("\n")
		.slice(0, 4096);
}

export function markCurrentTrancheShipped(
	program: Readonly<ProgramRun>,
	deliveryManifestId: string,
): ProgramRun {
	if (program.currentTrancheId === null || program.status !== "ACTIVE") {
		return programRunSchema.parse(program);
	}

	const currentTranche = getCurrentTranche(program);
	if (currentTranche === null) {
		return programRunSchema.parse(program);
	}

	const nextPending = findNextPendingTranche(program, currentTranche.sequence);
	const tranches = program.tranches.map((tranche) => {
		if (tranche.trancheId === currentTranche.trancheId) {
			return trancheSchema.parse({
				...tranche,
				status: "SHIPPED",
				deliveryManifestId,
			});
		}
		if (nextPending && tranche.trancheId === nextPending.trancheId) {
			return trancheSchema.parse({
				...tranche,
				status: "QUEUED",
			});
		}
		return tranche;
	});

	return programRunSchema.parse({
		...program,
		tranches,
	});
}

export function advanceProgramToNextTranche(program: Readonly<ProgramRun>): ProgramRun {
	if (program.status !== "ACTIVE") {
		return programRunSchema.parse(program);
	}

	const currentTranche = getCurrentTranche(program);
	const currentSequence = currentTranche?.sequence ?? 0;
	const nextTranche =
		program.tranches.find(
			(tranche) =>
				tranche.sequence > currentSequence &&
				(tranche.status === "QUEUED" || tranche.status === "PENDING"),
		) ?? null;

	let tranches: readonly Tranche[] = program.tranches;
	if (currentTranche) {
		tranches = updateTranche(program, currentTranche.trancheId, (tranche) =>
			trancheSchema.parse({
				...tranche,
				status: tranche.status === "BLOCKED" ? "BLOCKED" : "COMPLETED",
			}),
		);
	}

	if (!nextTranche) {
		return finalizeProgramRun(program, {
			status: "COMPLETED",
			tranches,
		});
	}

	tranches = updateTranche({ tranches }, nextTranche.trancheId, (tranche) =>
		trancheSchema.parse({
			...tranche,
			status: "IN_PROGRESS",
		}),
	);

	return programRunSchema.parse({
		...program,
		status: "ACTIVE",
		currentTrancheId: nextTranche.trancheId,
		tranches,
	});
}

export function finalizeProgramRun(
	program: Readonly<ProgramRun>,
	options?: {
		readonly status?: "COMPLETED" | "BLOCKED";
		readonly blockedReason?: string | null;
		readonly finalOracleVerdict?: string | null;
		readonly tranches?: readonly Tranche[];
	},
): ProgramRun {
	const status = options?.status ?? "COMPLETED";
	const tranches = options?.tranches ?? program.tranches;

	return programRunSchema.parse({
		...program,
		status,
		currentTrancheId: null,
		tranches,
		blockedReason:
			status === "BLOCKED" ? truncate(options?.blockedReason ?? "Program blocked", 2048) : null,
		finalOracleVerdict:
			options?.finalOracleVerdict === null || options?.finalOracleVerdict === undefined
				? null
				: truncate(options.finalOracleVerdict, 1024),
	});
}

export function blockProgramRun(
	program: Readonly<ProgramRun>,
	reason: string,
	trancheId?: string,
): ProgramRun {
	const blockedTrancheId = trancheId ?? program.currentTrancheId;
	const tranches =
		blockedTrancheId === undefined || blockedTrancheId === null
			? program.tranches
			: updateTranche(program, blockedTrancheId, (tranche) =>
					trancheSchema.parse({
						...tranche,
						status: "BLOCKED",
					}),
				);

	return programRunSchema.parse({
		...program,
		status: "BLOCKED",
		blockedReason: truncate(reason, 2048),
		currentTrancheId: blockedTrancheId ?? program.currentTrancheId,
		tranches,
	});
}

export function abandonProgramRun(program: Readonly<ProgramRun>): ProgramRun {
	return programRunSchema.parse({
		...program,
		status: "ABANDONED",
	});
}
