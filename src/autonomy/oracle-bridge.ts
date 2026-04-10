import { randomUUID } from "node:crypto";

export interface OracleResult {
	readonly status: "verified" | "failed";
	readonly summary: string;
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

function buildOraclePrompt(task: string, completionEvidence: string, attemptId: string): string {
	return [
		"Review this completion claim and decide whether it is verified.",
		`Respond with a line starting with 'ATTEMPT_ID:' followed by ${attemptId}.`,
		"If the completion is verified, include a line containing '<promise>VERIFIED</promise>'.",
		"Respond with a line starting with 'VERDICT:' followed by VERIFIED or FAILED.",
		"If VERIFIED, include a line starting with 'SUMMARY:' containing the verification summary.",
		"If FAILED, include a line starting with 'FIX_INSTRUCTIONS:' containing concrete fix steps.",
		"",
		`ATTEMPT_ID: ${attemptId}`,
		`Task: ${task}`,
		"Completion evidence:",
		completionEvidence,
	].join("\n");
}

function extractResponseBlock(rawEvidence: string, attemptId?: string): string | null {
	const blocks = [
		...rawEvidence.matchAll(/ATTEMPT_ID:\s*(\S+)([\s\S]*?)(?=ATTEMPT_ID:\s*\S+|$)/gi),
	].map((match) =>
		Object.freeze({
			attemptId: match[1],
			text: `ATTEMPT_ID: ${match[1]}${match[2]}`.trim(),
		}),
	);

	if (blocks.length === 0) {
		return attemptId ? null : rawEvidence;
	}

	if (!attemptId) {
		return blocks.at(-1)?.text ?? null;
	}

	return blocks.findLast((block) => block.attemptId === attemptId)?.text ?? null;
}

export function parseOracleVerificationEvidence(
	evidence: readonly string[] | string,
	attemptId?: string,
): OracleResult | null {
	const rawEvidence = normalizeOracleEvidence(evidence);
	const responseBlock = extractResponseBlock(rawEvidence, attemptId);
	if (!responseBlock) {
		return null;
	}

	const matchedAttemptId = responseBlock.match(/ATTEMPT_ID:\s*(\S+)/i)?.[1] ?? null;
	const verdictMatch = responseBlock.match(/(?:^|\n)VERDICT:\s*(VERIFIED|FAILED)(?=\s*(?:\n|$))/i);
	if (!verdictMatch) {
		return null;
	}

	const hasVerifiedPromise = responseBlock
		.split(/\r?\n/)
		.some((line) => line.trim() === "<promise>VERIFIED</promise>");

	const summaryMatch = responseBlock.match(/(?:^|\n)SUMMARY:\s*([\s\S]+)/i);
	const fixInstructionsMatch = responseBlock.match(/(?:^|\n)FIX_INSTRUCTIONS:\s*([\s\S]+)/i);
	const verdict = verdictMatch[1].toUpperCase();
	if (verdict === "VERIFIED" && (!summaryMatch || !hasVerifiedPromise)) {
		return null;
	}

	if (verdict === "FAILED" && !fixInstructionsMatch) {
		return null;
	}

	return Object.freeze({
		status: verdict === "VERIFIED" ? "verified" : "failed",
		summary:
			(verdict === "VERIFIED" ? summaryMatch?.[1] : fixInstructionsMatch?.[1])?.trim() ??
			responseBlock.trim(),
		rawEvidence,
		attemptId: matchedAttemptId,
	});
}

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
			prompt: buildOraclePrompt(request.task, request.completionEvidence, attemptId),
		});
	}

	async checkOracleResult(consultation: OracleConsultation): Promise<OracleResult | null> {
		if (!this.deps.readOracleSessionMessages) {
			return null;
		}

		const messages = await this.deps.readOracleSessionMessages(consultation);
		return parseOracleVerificationEvidence(messages, consultation.attemptId);
	}
}
