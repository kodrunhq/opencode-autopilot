import { z } from "zod";
import { dispatchResultKindSchema, type pendingDispatchSchema, phaseSchema } from "../schemas";

export const resultKindSchema = dispatchResultKindSchema;

export const resultEnvelopeSchema = z.object({
	schemaVersion: z.literal(1).default(1),
	resultId: z.string().min(1).max(128),
	runId: z.string().min(1).max(128),
	phase: phaseSchema,
	dispatchId: z.string().min(1).max(128),
	agent: z.string().min(1).max(128).nullable().default(null),
	kind: resultKindSchema,
	taskId: z.number().int().positive().nullable().default(null),
	payload: z
		.object({
			text: z.string().max(1_048_576).default(""),
		})
		.passthrough(),
});

export type PendingDispatch = z.infer<typeof pendingDispatchSchema>;
export type ResultEnvelope = z.infer<typeof resultEnvelopeSchema>;
