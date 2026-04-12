import { randomUUID } from "node:crypto";
import {
	buildProgramOracleSignoffRequest,
	isPassingProgramOracleSignoff,
	type ProgramOracleSignoff,
	parseProgramOracleSignoff,
} from "../orchestrator/signoff";

export interface OracleResult {
	readonly status: "verified" | "failed";
	readonly summary: string;
	readonly signoff: ProgramOracleSignoff;
	readonly rawEvidence: string;
	readonly attemptId: string | null;
}

export interface OracleConsultation {
	readonly sessionId: string;
	readonly attemptId: string;
	readonly parentSessionId: string;
}

export interface OracleConsultationRequest {
	readonly task: string;
	readonly completionEvidence: string;
	readonly parentSessionId: string | null;
	readonly unresolvedRisks?: readonly string[];
	readonly acceptedWaivers?: readonly string[];
}

export interface OracleBridge {
	requestOracleConsultation(request: OracleConsultationRequest): Promise<OracleConsultation>;
	checkOracleResult(consultation: OracleConsultation): Promise<OracleResult | null>;
}

export interface OracleBridgeDeps {
	readonly dispatchOracleTask?: (
		request: OracleConsultationRequest & { readonly attemptId: string; readonly prompt: string },
	) => Promise<OracleConsultation>;
	readonly readOracleSessionMessages?: (
		consultation: OracleConsultation,
	) => Promise<readonly string[]>;
	readonly generateAttemptId?: () => string;
}

function normalizeOracleEvidence(evidence: readonly string[] | string): string {
	return typeof evidence === "string" ? evidence : evidence.join("\n");
}

function buildOraclePrompt(request: OracleConsultationRequest, attemptId: string): string {
	return buildProgramOracleSignoffRequest(
		{
			originalDossierRequest: request.task,
			trancheResults: request.completionEvidence
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length > 0),
			unresolvedRisks: request.unresolvedRisks ?? [],
			acceptedWaivers: request.acceptedWaivers ?? [],
		},
		{ signoffId: attemptId },
	).prompt;
}

export function parseProgramOracleSignoffEvidence(
	evidence: readonly string[] | string,
	attemptId?: string,
): OracleResult | null {
	const rawEvidence = normalizeOracleEvidence(evidence);
	if (!rawEvidence.includes("<oracle-signoff")) {
		return null;
	}

	const signoff = parseProgramOracleSignoff(rawEvidence, {
		expectedSignoffId: attemptId,
	});
	if (!signoff) {
		return null;
	}

	return Object.freeze({
		status: isPassingProgramOracleSignoff(signoff) ? "verified" : "failed",
		summary: signoff.reasoning,
		signoff,
		rawEvidence,
		attemptId: signoff.signoffId,
	});
}

export const parseOracleVerificationEvidence = parseProgramOracleSignoffEvidence;

export class TaskOracleBridge implements OracleBridge {
	constructor(private readonly deps: OracleBridgeDeps = {}) {}

	async requestOracleConsultation(request: OracleConsultationRequest): Promise<OracleConsultation> {
		if (!this.deps.dispatchOracleTask) {
			throw new Error("Oracle bridge is not configured for task dispatch.");
		}

		if (!request.parentSessionId) {
			throw new Error("No active session available for Oracle dispatch.");
		}

		const attemptId = this.deps.generateAttemptId?.() ?? randomUUID();
		return this.deps.dispatchOracleTask({
			...request,
			attemptId,
			prompt: buildOraclePrompt(request, attemptId),
		});
	}

	async checkOracleResult(consultation: OracleConsultation): Promise<OracleResult | null> {
		if (!this.deps.readOracleSessionMessages) {
			return null;
		}

		const messages = await this.deps.readOracleSessionMessages(consultation);
		if (messages.length === 0) {
			return null;
		}

		return parseProgramOracleSignoffEvidence(messages, consultation.attemptId);
	}
}
