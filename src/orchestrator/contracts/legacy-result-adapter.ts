import { z } from "zod";
import type { Phase } from "../types";
import { type ResultEnvelope, resultEnvelopeSchema } from "./result-envelope";

export interface ParseTypedResultEnvelopeResult {
	readonly envelope: ResultEnvelope;
}

export function coerceResultEnvelope(raw: unknown): unknown {
	if (typeof raw !== "object" || raw === null) {
		return raw;
	}

	const obj = raw as Record<string, unknown>;
	const coerced: Record<string, unknown> = { ...obj };

	if (typeof coerced.taskId === "string" && /^\d+$/.test(coerced.taskId)) {
		coerced.taskId = Number(coerced.taskId);
	}

	if (coerced.schemaVersion === undefined) {
		coerced.schemaVersion = 1;
	}

	if (coerced.agent === undefined) {
		coerced.agent = null;
	}

	if (coerced.taskId === undefined) {
		coerced.taskId = null;
	}

	if (typeof coerced.payload === "string") {
		coerced.payload = { text: coerced.payload };
	}

	if (typeof coerced.payload === "object" && coerced.payload !== null) {
		const payload = coerced.payload as Record<string, unknown>;
		if (payload.text === undefined) {
			coerced.payload = { ...payload, text: "" };
		}
	}

	return coerced;
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
		const coerced = coerceResultEnvelope(parsed);
		if (typeof coerced !== "object" || coerced === null) {
			throw new Error("E_INVALID_RESULT_NON_OBJECT");
		}
		const envelope = resultEnvelopeSchema.parse(coerced);
		return { envelope };
	} catch (error: unknown) {
		if (error instanceof Error && error.message === "E_INVALID_RESULT_NON_OBJECT") {
			throw new Error(
				"E_INVALID_RESULT: Result payload must be a typed result envelope JSON object.",
			);
		}
		if (error instanceof z.ZodError) {
			throw new Error(`E_INVALID_RESULT: ${error.issues[0]?.message ?? "invalid envelope"}`);
		}
		throw new Error(
			"E_INVALID_RESULT: Result payload must be a typed result envelope JSON object.",
		);
	}
}
