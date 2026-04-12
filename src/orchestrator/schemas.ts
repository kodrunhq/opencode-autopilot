import { randomBytes } from "node:crypto";
import { z } from "zod";
import { reviewStatusSchema } from "./review-runner";
import { oracleSignoffStateSchema } from "./signoff";

function generateRunId(): string {
	return `run_${randomBytes(8).toString("hex")}`;
}

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
	phaseNumber: z.number().int().positive(),
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

const baseBuildProgressSchema = z.object({
	currentTask: z.number().nullable().default(null),
	currentTasks: z.array(z.number()).default([]),
	currentWave: z.number().nullable().default(null),
	attemptCount: z.number().default(0),
	strikeCount: z.number().default(0),
	reviewPending: z.boolean().default(false),
	oraclePending: z.boolean().default(false),
	oracleSignoffId: z.string().max(128).nullable().default(null),
	oracleInputsDigest: z.string().max(128).nullable().default(null),
	lastReviewReport: z.string().max(16_384).nullable().default(null),
});

// Full schema with defaults for pipeline state
export const buildProgressSchema = baseBuildProgressSchema;

// BuildProgress type from schema output (includes defaults from transform)
export type BuildProgress = z.output<typeof baseBuildProgressSchema>;

export const dispatchResultKindSchema = z.enum([
	"phase_output",
	"task_completion",
	"review_findings",
	"oracle_signoff",
]);

const pendingDispatchSessionIdSchema = z.string().max(256).nullable();

export const pendingDispatchSchema = z
	.object({
		dispatchId: z.string().min(1).max(128),
		phase: phaseSchema,
		agent: z.string().min(1).max(128),
		issuedAt: z.string().max(128),
		status: z.enum(["PENDING", "RESULT_RECEIVED", "FAILED_RECOVERABLE"]).default("PENDING"),
		receivedResultId: z.string().max(128).nullable().default(null),
		receivedAt: z.string().max(128).nullable().default(null),
		resultKind: dispatchResultKindSchema.default("phase_output"),
		taskId: z
			.union([z.number().int().positive(), z.string().min(1).max(128)])
			.nullable()
			.default(null),
		callerSessionId: pendingDispatchSessionIdSchema.optional(),
		spawnedSessionId: pendingDispatchSessionIdSchema.optional(),
		// Legacy alias retained while callers migrate.
		sessionId: pendingDispatchSessionIdSchema.optional(),
	})
	.transform((input) => {
		const callerSessionId = input.callerSessionId ?? input.sessionId ?? null;

		return {
			dispatchId: input.dispatchId,
			phase: input.phase,
			agent: input.agent,
			issuedAt: input.issuedAt,
			status: input.status,
			receivedResultId: input.receivedResultId,
			receivedAt: input.receivedAt,
			resultKind: input.resultKind,
			taskId: input.taskId,
			callerSessionId,
			spawnedSessionId: input.spawnedSessionId ?? null,
			sessionId: callerSessionId,
		};
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
	programId: z.string().max(128).nullable().default(null),
	trancheId: z.string().max(128).nullable().default(null),
	humanTitle: z.string().max(256).nullable().default(null),
	commitStrategy: z.enum(["per_task", "per_wave", "squash"]).default("per_task"),
	reviewSummary: z.string().max(4096).nullable().default(null),
	oracleSummary: z.string().max(4096).nullable().default(null),
	verificationSummary: z.string().max(4096).nullable().default(null),
});

export const verificationCheckStatusSchema = z.enum([
	"PASSED",
	"FAILED",
	"BLOCKED",
	"PENDING",
	"SKIPPED_WITH_REASON",
]);

export const pipelineVerificationStatusSchema = z.object({
	status: z.enum(["NOT_STARTED", "PASSED", "FAILED", "BLOCKED", "PENDING"]),
	summary: z.string().max(4096).nullable().default(null),
	localStatus: verificationCheckStatusSchema.nullable().default(null),
	localSummary: z.string().max(4096).nullable().default(null),
	ciStatus: verificationCheckStatusSchema.nullable().default(null),
	ciSummary: z.string().max(4096).nullable().default(null),
	updatedAt: z.string().max(128).nullable().default(null),
});

export const programContextSchema = z.object({
	programId: z.string().min(1).max(128),
	trancheId: z.string().min(1).max(128),
	trancheTitle: z.string().min(1).max(512),
	trancheIndex: z.number().int().positive(),
	trancheCount: z.number().int().positive(),
	selectionRationale: z.string().max(2048),
	originatingRequest: z.string().max(4096),
	mode: z.enum(["autonomous", "interactive"]),
});

export const pipelineStateSchema = z.object({
	schemaVersion: z.literal(2),
	status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED", "INTERRUPTED"]),
	runId: z
		.string()
		.max(128)
		.regex(/^[a-z0-9_-]+$/i, "runId must be alphanumeric with hyphens or underscores")
		.default(generateRunId),
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
	buildProgress: baseBuildProgressSchema.default({
		currentTask: null,
		currentTasks: [],
		currentWave: null,
		attemptCount: 0,
		strikeCount: 0,
		reviewPending: false,
		oraclePending: false,
		oracleSignoffId: null,
		oracleInputsDigest: null,
		lastReviewReport: null,
	}),
	oracleSignoffs: oracleSignoffStateSchema.default({
		tranche: null,
		program: null,
	}),
	pendingDispatches: z.array(pendingDispatchSchema).max(2000).default([]),
	processedResultIds: z.array(z.string().max(128)).max(10_000).default([]),
	failureContext: failureContextSchema.nullable().default(null),
	branchLifecycle: branchLifecycleSchema.nullable().default(null),
	verificationStatus: pipelineVerificationStatusSchema.default({
		status: "NOT_STARTED",
		summary: null,
		localStatus: null,
		localSummary: null,
		ciStatus: null,
		ciSummary: null,
		updatedAt: null,
	}),
	programContext: programContextSchema.nullable().default(null),
	phaseDispatchCounts: z.record(z.string().max(32), z.number().int().min(0).max(1000)).default({}),
	retryAttempts: z.record(z.string().max(128), z.number().int().min(0).max(100)).default({}),
	useWorktrees: z.boolean().default(false),
	reviewStatus: reviewStatusSchema.default(reviewStatusSchema.parse({})),
});
