import { z } from "zod";
import type { Phase } from "../types";
import { type ResultEnvelope, resultEnvelopeSchema } from "./result-envelope";

export interface ParseResultEnvelopeResult {
	readonly envelope: ResultEnvelope;
	readonly legacy: boolean;
}

export function parseResultEnvelope(
	raw: string,
	ctx: {
		readonly runId: string;
		readonly phase: Phase;
		readonly fallbackDispatchId: string;
		readonly fallbackAgent?: string | null;
	},
): ParseResultEnvelopeResult {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		throw new Error("E_INVALID_RESULT: empty result payload");
	}

	try {
		const parsed = JSON.parse(trimmed);
		const envelope = resultEnvelopeSchema.parse(parsed);
		return { envelope, legacy: false };
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			throw new Error(`E_INVALID_RESULT: ${error.issues[0]?.message ?? "invalid envelope"}`);
		}
		const legacyEnvelope = resultEnvelopeSchema.parse({
			schemaVersion: 1,
			resultId: `legacy-${ctx.fallbackDispatchId}`,
			runId: ctx.runId,
			phase: ctx.phase,
			dispatchId: ctx.fallbackDispatchId,
			agent: ctx.fallbackAgent ?? null,
			kind: "phase_output",
			taskId: null,
			payload: {
				text: raw,
			},
		});
		return { envelope: legacyEnvelope, legacy: true };
	}
}
