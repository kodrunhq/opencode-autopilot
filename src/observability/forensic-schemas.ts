import { z } from "zod";

export const forensicEventTypeSchema = z.enum([
	"run_started",
	"dispatch",
	"dispatch_multi",
	"result_applied",
	"phase_transition",
	"complete",
	"decision",
	"error",
	"loop_detected",
	"failure_recorded",
	"warning",
	"session_start",
	"session_end",
	"fallback",
	"model_switch",
	"context_warning",
	"tool_complete",
	"compacted",
]);

export const forensicEventDomainSchema = z.enum(["session", "orchestrator", "contract"]);

export type JsonValue =
	| null
	| boolean
	| number
	| string
	| readonly JsonValue[]
	| { readonly [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([
		z.null(),
		z.boolean(),
		z.number(),
		z.string(),
		z.array(jsonValueSchema),
		z.record(z.string(), jsonValueSchema),
	]),
);

export const forensicEventSchema = z.object({
	schemaVersion: z.literal(1),
	timestamp: z.string().max(128),
	projectRoot: z.string().max(4096),
	domain: forensicEventDomainSchema,
	runId: z.string().max(128).nullable().default(null),
	sessionId: z.string().max(256).nullable().default(null),
	parentSessionId: z.string().max(256).nullable().default(null),
	phase: z.string().max(128).nullable().default(null),
	dispatchId: z.string().max(128).nullable().default(null),
	taskId: z.number().int().positive().nullable().default(null),
	agent: z.string().max(128).nullable().default(null),
	type: forensicEventTypeSchema,
	code: z.string().max(128).nullable().default(null),
	message: z.string().max(4096).nullable().default(null),
	payload: z.record(z.string(), jsonValueSchema).default({}),
});

export const forensicEventDefaults = forensicEventSchema.parse({
	schemaVersion: 1,
	timestamp: new Date(0).toISOString(),
	projectRoot: "/unknown",
	domain: "orchestrator",
	type: "error",
});
