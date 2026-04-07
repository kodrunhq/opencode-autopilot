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
	completedAt: z.string().max(128).nullable().default(null),
	confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().default(null),
});

export const decisionEntrySchema = z.object({
	timestamp: z.string().max(128),
	phase: z.string().max(128),
	agent: z.string().max(128),
	decision: z.string().max(2048),
	rationale: z.string().max(2048),
});

export const confidenceEntrySchema = z.object({
	timestamp: z.string().max(128),
	phase: z.string().max(128),
	agent: z.string().max(128),
	area: z.string().max(128),
	level: z.enum(["HIGH", "MEDIUM", "LOW"]),
	rationale: z.string().max(2048),
});

export const taskSchema = z.object({
	id: z.number(),
	title: z.string().max(2048),
	status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "FAILED", "SKIPPED", "BLOCKED"]),
	wave: z.number(),
	depends_on: z.array(z.number()).default([]),
	attempt: z.number().default(0),
	strike: z.number().default(0),
});

export const buildProgressSchema = z.object({
	currentTask: z.number().nullable().default(null),
	currentWave: z.number().nullable().default(null),
	attemptCount: z.number().default(0),
	strikeCount: z.number().default(0),
	reviewPending: z.boolean().default(false),
});

export const dispatchResultKindSchema = z.enum([
	"phase_output",
	"task_completion",
	"review_findings",
]);

export const pendingDispatchSchema = z.object({
	dispatchId: z.string().min(1).max(128),
	phase: phaseSchema,
	agent: z.string().min(1).max(128),
	issuedAt: z.string().max(128),
	resultKind: dispatchResultKindSchema.default("phase_output"),
	taskId: z
		.union([z.number().int().positive(), z.string().min(1).max(128)])
		.nullable()
		.default(null),
});

export const failureContextSchema = z.object({
	failedPhase: phaseSchema,
	failedAgent: z.string().max(128).nullable(),
	errorMessage: z.string().max(4096),
	timestamp: z.string().max(128),
	lastSuccessfulPhase: phaseSchema.nullable(),
});

export const branchLifecycleSchema = z.object({
	currentBranch: z.string().max(256).nullable().default(null),
	baseBranch: z.string().max(256).nullable().default(null),
	prNumber: z.number().int().positive().nullable().default(null),
	prUrl: z.string().max(1024).nullable().default(null),
	worktreePath: z.string().max(1024).nullable().default(null),
	createdAt: z.string().max(128).nullable().default(null),
	lastPushedAt: z.string().max(128).nullable().default(null),
	tasksPushed: z.array(z.string().max(128)).max(1000).default([]),
});

export const pipelineStateSchema = z.object({
	schemaVersion: z.literal(2),
	status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED", "INTERRUPTED"]),
	runId: z.string().max(128).default("legacy-run"),
	stateRevision: z.number().int().min(0).default(0),
	idea: z.string().max(4096),
	currentPhase: phaseSchema.nullable(),
	startedAt: z.string().max(128),
	lastUpdatedAt: z.string().max(128),
	phases: z.array(phaseStatusSchema),
	decisions: z.array(decisionEntrySchema).max(1000).default([]),
	confidence: z.array(confidenceEntrySchema).max(1000).default([]),
	tasks: z.array(taskSchema).default([]),
	arenaConfidence: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().default(null),
	exploreTriggered: z.boolean().default(false),
	buildProgress: buildProgressSchema.default({
		currentTask: null,
		currentWave: null,
		attemptCount: 0,
		strikeCount: 0,
		reviewPending: false,
	}),
	pendingDispatches: z.array(pendingDispatchSchema).max(2000).default([]),
	processedResultIds: z.array(z.string().max(128)).max(10_000).default([]),
	failureContext: failureContextSchema.nullable().default(null),
	branchLifecycle: branchLifecycleSchema.nullable().default(null),
	phaseDispatchCounts: z.record(z.string().max(32), z.number().int().min(0).max(1000)).default({}),
});
