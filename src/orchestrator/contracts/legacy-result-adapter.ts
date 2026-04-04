import { z } from "zod";
import type { Phase } from "../types";
import { type ResultEnvelope, resultEnvelopeSchema } from "./result-envelope";

export interface ParseTypedResultEnvelopeResult {
	readonly envelope: ResultEnvelope;
}

export function parseTypedResultEnvelope(
	raw: string,
	_ctx: {
		readonly runId: string;
		readonly phase: Phase;
		readonly fallbackDispatchId: string;
		readonly fallbackAgent?: string | null;
	},
): ParseTypedResultEnvelopeResult {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		throw new Error("E_INVALID_RESULT: empty result payload");
	}

	try {
		const parsed = JSON.parse(trimmed);
		const envelope = resultEnvelopeSchema.parse(parsed);
		return { envelope };
	} catch (error: unknown) {
		if (error instanceof z.ZodError) {
			throw new Error(`E_INVALID_RESULT: ${error.issues[0]?.message ?? "invalid envelope"}`);
		}
		throw new Error(
			"E_INVALID_RESULT: Result payload must be a typed result envelope JSON object.",
		);
	}
}
