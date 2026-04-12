import { createHash, randomBytes } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { ensureDir } from "../utils/fs-helpers";

const ORACLE_SIGNOFF_BLOCK_PATTERN =
	/<oracle-signoff\s+id=["']([^"']+)["']\s*>([\s\S]*?)<\/oracle-signoff>/gi;

const TRANCHE_SIGNOFF_FILENAME = "tranche-oracle-signoff.json";
const PROGRAM_SIGNOFF_FILENAME = "program-oracle-signoff.json";

export const trancheOracleSignoffSchema = z
	.object({
		signoffId: z.string().min(1).max(128),
		scope: z.literal("TRANCHE"),
		inputsDigest: z.string().min(1).max(128),
		verdict: z.enum(["PASS", "PASS_WITH_NEXT_TRANCHE", "FAIL"]),
		reasoning: z.string().min(1).max(16_384),
		blockingConditions: z.array(z.string().min(1).max(2048)).max(100),
	})
	.superRefine((value, ctx) => {
		if (value.verdict === "FAIL" && value.blockingConditions.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "FAIL tranche signoff must include at least one blocking condition.",
				path: ["blockingConditions"],
			});
		}

		if (value.verdict !== "FAIL" && value.blockingConditions.length > 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Passing tranche signoff must not include blocking conditions.",
				path: ["blockingConditions"],
			});
		}
	});

export const programOracleSignoffSchema = z.object({
	signoffId: z.string().min(1).max(128),
	scope: z.literal("PROGRAM"),
	inputsDigest: z.string().min(1).max(128),
	verdict: z.enum(["PASS", "COMPLETE", "PENDING", "FAIL", "INCOMPLETE", "FAILED"]),
	reasoning: z.string().min(1).max(16_384),
});

export const oracleSignoffStateSchema = z.object({
	tranche: trancheOracleSignoffSchema.nullable().default(null),
	program: programOracleSignoffSchema.nullable().default(null),
});

export type TrancheOracleSignoff = z.infer<typeof trancheOracleSignoffSchema>;
export type ProgramOracleSignoff = z.infer<typeof programOracleSignoffSchema>;
export type OracleSignoffState = z.infer<typeof oracleSignoffStateSchema>;

export interface TrancheOracleSignoffInputs {
	readonly originalIntent: string;
	readonly trancheIntent: string;
	readonly diffSummary: string;
	readonly reviewReport: string;
	readonly verificationResults: string;
	readonly remainingBacklog: readonly string[];
}

export interface ProgramOracleSignoffInputs {
	readonly originalDossierRequest: string;
	readonly trancheResults: readonly string[];
	readonly unresolvedRisks: readonly string[];
	readonly acceptedWaivers: readonly string[];
}

function createSignoffId(prefix: "tranche" | "program"): string {
	return `${prefix}_signoff_${randomBytes(6).toString("hex")}`;
}

function createInputsDigest(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

function buildOracleSignoffEnvelope(signoffId: string, body: string): string {
	return [`<oracle-signoff id="${signoffId}">`, body, `</oracle-signoff>`].join("\n");
}

function extractOracleSignoffBlocks(
	rawEvidence: string,
): readonly { readonly signoffId: string; readonly body: string }[] {
	const blocks = [...rawEvidence.matchAll(ORACLE_SIGNOFF_BLOCK_PATTERN)].map((match) =>
		Object.freeze({
			signoffId: match[1],
			body: match[2].trim(),
		}),
	);

	return Object.freeze(blocks);
}

function parseTaggedOracleSignoff<T>(
	rawEvidence: string,
	schema: z.ZodSchema<T>,
	options?: { readonly expectedSignoffId?: string; readonly expectedInputsDigest?: string },
): T | null {
	const trimmedEvidence = rawEvidence.trim();
	if (trimmedEvidence.length === 0) {
		return null;
	}

	const blocks = extractOracleSignoffBlocks(trimmedEvidence);
	if (blocks.length === 0) {
		throw new Error("Missing <oracle-signoff> block in Oracle response.");
	}

	const matchingBlocks = options?.expectedSignoffId
		? blocks.filter((block) => block.signoffId === options.expectedSignoffId)
		: blocks;

	if (matchingBlocks.length === 0) {
		return null;
	}

	const candidate = matchingBlocks.at(-1);
	if (!candidate) {
		return null;
	}

	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(candidate.body);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Oracle signoff JSON parse failed for ${candidate.signoffId}: ${message}`);
	}

	const signoff = schema.parse(parsedJson);
	const signoffRecord = signoff as { readonly signoffId?: string; readonly inputsDigest?: string };
	if (signoffRecord.signoffId !== candidate.signoffId) {
		throw new Error(
			`Oracle signoff block id ${candidate.signoffId} does not match payload signoffId ${String(signoffRecord.signoffId)}.`,
		);
	}

	if (
		options?.expectedInputsDigest !== undefined &&
		signoffRecord.inputsDigest !== options.expectedInputsDigest
	) {
		throw new Error(
			`Oracle signoff inputsDigest ${String(signoffRecord.inputsDigest)} does not match expected ${options.expectedInputsDigest}.`,
		);
	}

	return signoff;
}

function renderList(items: readonly string[], emptyLabel: string): string {
	if (items.length === 0) {
		return emptyLabel;
	}

	return items.map((item) => `- ${item}`).join("\n");
}

async function persistSignoffArtifact<T>(artifactPath: string, signoff: T): Promise<void> {
	await ensureDir(dirname(artifactPath));
	const tmpPath = `${artifactPath}.tmp.${randomBytes(6).toString("hex")}`;
	await writeFile(tmpPath, JSON.stringify(signoff, null, 2), "utf-8");
	await rename(tmpPath, artifactPath);
}

function getSignoffDir(artifactDir: string, runId?: string): string {
	return runId ? join(artifactDir, "signoffs", runId) : join(artifactDir, "signoffs");
}

export function getTrancheOracleSignoffArtifactPath(artifactDir: string, runId?: string): string {
	return join(getSignoffDir(artifactDir, runId), TRANCHE_SIGNOFF_FILENAME);
}

export function getProgramOracleSignoffArtifactPath(artifactDir: string, runId?: string): string {
	return join(getSignoffDir(artifactDir, runId), PROGRAM_SIGNOFF_FILENAME);
}

export async function persistTrancheOracleSignoff(
	artifactDir: string,
	signoff: TrancheOracleSignoff,
	runId?: string,
): Promise<string> {
	const artifactPath = getTrancheOracleSignoffArtifactPath(artifactDir, runId);
	await persistSignoffArtifact(artifactPath, signoff);
	return artifactPath;
}

export async function persistProgramOracleSignoff(
	artifactDir: string,
	signoff: ProgramOracleSignoff,
	runId?: string,
): Promise<string> {
	const artifactPath = getProgramOracleSignoffArtifactPath(artifactDir, runId);
	await persistSignoffArtifact(artifactPath, signoff);
	return artifactPath;
}

export function buildTrancheOracleSignoffRequest(inputs: TrancheOracleSignoffInputs): {
	readonly prompt: string;
	readonly signoffId: string;
	readonly inputsDigest: string;
} {
	const signoffId = createSignoffId("tranche");
	const inputsDigest = createInputsDigest(inputs);
	const expectedJson = JSON.stringify(
		{
			signoffId,
			scope: "TRANCHE",
			inputsDigest,
			verdict: "PASS | PASS_WITH_NEXT_TRANCHE | FAIL",
			reasoning: "Required rationale",
			blockingConditions: ["Required only when verdict is FAIL"],
		},
		null,
		2,
	);

	const prompt = [
		"Mandatory tranche Oracle signoff request.",
		"Return exactly one <oracle-signoff> block and no surrounding prose.",
		`Use id="${signoffId}" on the <oracle-signoff> tag.`,
		`Echo signoffId=${signoffId} and inputsDigest=${inputsDigest} exactly in the JSON payload.`,
		"PASS and PASS_WITH_NEXT_TRANCHE require an empty blockingConditions array.",
		"FAIL requires blockingConditions to list every blocker.",
		"Expected JSON shape:",
		expectedJson,
		"",
		"Original intent:",
		inputs.originalIntent,
		"",
		"Tranche intent:",
		inputs.trancheIntent,
		"",
		"Diff summary:",
		inputs.diffSummary,
		"",
		"Review report:",
		inputs.reviewReport,
		"",
		"Verification results:",
		inputs.verificationResults,
		"",
		"Remaining backlog:",
		renderList(inputs.remainingBacklog, "- No remaining backlog recorded."),
	].join("\n");

	return Object.freeze({ prompt, signoffId, inputsDigest });
}

export function buildProgramOracleSignoffRequest(
	inputs: ProgramOracleSignoffInputs,
	options?: { readonly signoffId?: string },
): {
	readonly prompt: string;
	readonly signoffId: string;
	readonly inputsDigest: string;
} {
	const signoffId = options?.signoffId ?? createSignoffId("program");
	const inputsDigest = createInputsDigest(inputs);
	const expectedJson = JSON.stringify(
		{
			signoffId,
			scope: "PROGRAM",
			inputsDigest,
			verdict: "PASS | FAIL",
			reasoning: "Required rationale",
		},
		null,
		2,
	);

	const prompt = [
		"Mandatory program Oracle signoff request.",
		"Return exactly one <oracle-signoff> block and no surrounding prose.",
		`Use id="${signoffId}" on the <oracle-signoff> tag.`,
		`Echo signoffId=${signoffId} and inputsDigest=${inputsDigest} exactly in the JSON payload.`,
		"Use PASS only when the overall request is fully satisfied.",
		"Use FAIL when the current state is unacceptable for completion.",
		"Expected JSON shape:",
		expectedJson,
		"",
		"Original dossier request:",
		inputs.originalDossierRequest,
		"",
		"All tranche results:",
		renderList(inputs.trancheResults, "- No tranche results supplied."),
		"",
		"Unresolved risks:",
		renderList(inputs.unresolvedRisks, "- None recorded."),
		"",
		"Accepted waivers:",
		renderList(inputs.acceptedWaivers, "- None recorded."),
	].join("\n");

	return Object.freeze({ prompt, signoffId, inputsDigest });
}

export function parseTrancheOracleSignoff(
	evidence: readonly string[] | string,
	options?: { readonly expectedSignoffId?: string; readonly expectedInputsDigest?: string },
): TrancheOracleSignoff | null {
	const rawEvidence = typeof evidence === "string" ? evidence : evidence.join("\n");
	return parseTaggedOracleSignoff(rawEvidence, trancheOracleSignoffSchema, options);
}

export function parseProgramOracleSignoff(
	evidence: readonly string[] | string,
	options?: { readonly expectedSignoffId?: string; readonly expectedInputsDigest?: string },
): ProgramOracleSignoff | null {
	const rawEvidence = typeof evidence === "string" ? evidence : evidence.join("\n");
	return parseTaggedOracleSignoff(rawEvidence, programOracleSignoffSchema, options);
}

export function formatOracleSignoffEnvelope(
	signoff: TrancheOracleSignoff | ProgramOracleSignoff,
): string {
	return buildOracleSignoffEnvelope(signoff.signoffId, JSON.stringify(signoff, null, 2));
}

export function isPassingTrancheOracleSignoff(
	signoff: TrancheOracleSignoff | null | undefined,
): boolean {
	return signoff?.verdict === "PASS" || signoff?.verdict === "PASS_WITH_NEXT_TRANCHE";
}

export function isPassingProgramOracleSignoff(
	signoff: ProgramOracleSignoff | null | undefined,
): boolean {
	return signoff?.verdict === "PASS" || signoff?.verdict === "COMPLETE";
}
