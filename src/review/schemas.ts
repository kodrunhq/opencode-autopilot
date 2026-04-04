import { z } from "zod";

export const SEVERITIES = Object.freeze(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const);

export const VERDICTS = Object.freeze(["CLEAN", "APPROVED", "CONCERNS", "BLOCKED"] as const);

export const severitySchema = z.enum(SEVERITIES);

export const verdictSchema = z.enum(VERDICTS);

export const reviewFindingSchema = z.object({
	severity: severitySchema,
	domain: z.string().max(128),
	title: z.string().max(512),
	file: z.string().max(512),
	line: z.number().int().positive().optional(),
	agent: z.string().max(128),
	source: z.enum(["phase1", "cross-verification", "product-review", "red-team"]),
	evidence: z.string().max(4096),
	problem: z.string().max(2048),
	fix: z.string().max(2048),
});

export const agentResultSchema = z.object({
	agent: z.string().max(128),
	category: z.enum(["core", "parallel", "sequenced"]),
	findings: z.array(reviewFindingSchema).max(500).default([]),
	durationMs: z.number(),
	completedAt: z.string().max(128),
});

export const reviewReportSchema = z.object({
	verdict: verdictSchema,
	findings: z.array(reviewFindingSchema).max(500),
	agentResults: z.array(agentResultSchema).max(500),
	scope: z.string().max(128).default("unknown"),
	agentsRan: z.array(z.string().max(128)).max(32).default([]),
	totalDurationMs: z.number(),
	completedAt: z.string().max(128),
	summary: z.string().max(4096),
});

export const falsePositiveSchema = z.object({
	finding: reviewFindingSchema,
	reason: z.string().max(1024),
	markedAt: z.string().max(128),
});

export const reviewMemorySchema = z.object({
	schemaVersion: z.literal(1),
	projectProfile: z.object({
		stacks: z.array(z.string().max(128)).max(32),
		lastDetectedAt: z.string().max(128),
	}),
	recentFindings: z.array(reviewFindingSchema).max(100),
	falsePositives: z.array(falsePositiveSchema).max(50),
	lastReviewedAt: z.string().max(128).nullable(),
});

export const reviewStateSchema = z.object({
	stage: z.number().int().min(1).max(5),
	selectedAgentNames: z.array(z.string().max(128)).max(32),
	accumulatedFindings: z.array(reviewFindingSchema).max(500),
	scope: z.string().max(4096),
	startedAt: z.string().max(128),
});

export const reviewFindingsEnvelopeSchema = z.object({
	schemaVersion: z.literal(1).default(1),
	kind: z.literal("review_findings"),
	findings: z.array(reviewFindingSchema).max(500).default([]),
});

export const reviewConfigSchema = z.object({
	parallel: z.boolean().default(true),
	maxFixAttempts: z.number().int().min(0).max(10).default(3),
	severityThreshold: severitySchema.default("MEDIUM"),
	enableCrossVerification: z.boolean().default(true),
	enableRedTeam: z.boolean().default(true),
	enableProductReview: z.boolean().default(true),
});
