import { z } from "zod";

export const PHASES = Object.freeze([
	"RECON",
	"CHALLENGE",
	"ARCHITECT",
	"EXPLORE",
	"PLAN",
	"BUILD",
	"SHIP",
	"RETROSPECTIVE",
] as const);

export const phaseSchema = z.enum(PHASES);

export const phaseStatusSchema = z.object({
	name: phaseSchema,
	status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]),
	completedAt: z.string().nullable().default(null),
	confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().default(null),
});

export const decisionEntrySchema = z.object({
	timestamp: z.string(),
	phase: z.string(),
	agent: z.string(),
	decision: z.string(),
	rationale: z.string(),
});

export const confidenceEntrySchema = z.object({
	timestamp: z.string(),
	phase: z.string(),
	agent: z.string(),
	area: z.string(),
	level: z.enum(["HIGH", "MEDIUM", "LOW"]),
	rationale: z.string(),
});

export const taskSchema = z.object({
	id: z.number(),
	title: z.string(),
	status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "FAILED", "SKIPPED", "BLOCKED"]),
	wave: z.number(),
	attempt: z.number().default(0),
	strike: z.number().default(0),
});

export const pipelineStateSchema = z.object({
	schemaVersion: z.literal(2),
	status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED"]),
	idea: z.string(),
	currentPhase: phaseSchema.nullable(),
	startedAt: z.string(),
	lastUpdatedAt: z.string(),
	phases: z.array(phaseStatusSchema),
	decisions: z.array(decisionEntrySchema).default([]),
	confidence: z.array(confidenceEntrySchema).default([]),
	tasks: z.array(taskSchema).default([]),
	arenaConfidence: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().default(null),
	exploreTriggered: z.boolean().default(false),
});
