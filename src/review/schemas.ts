import { z } from "zod";

export const SEVERITIES = Object.freeze(["CRITICAL", "WARNING", "NITPICK"] as const);

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
	findings: z.array(reviewFindingSchema).default([]),
	durationMs: z.number(),
	completedAt: z.string().max(128),
});

export const reviewReportSchema = z.object({
	verdict: verdictSchema,
	findings: z.array(reviewFindingSchema),
	agentResults: z.array(agentResultSchema),
	totalDurationMs: z.number(),
	completedAt: z.string().max(128),
	summary: z.string().max(4096),
});

export const reviewConfigSchema = z.object({
	parallel: z.boolean().default(true),
	maxFixAttempts: z.number().int().min(0).max(10).default(3),
	severityThreshold: severitySchema.default("WARNING"),
	enableCrossVerification: z.boolean().default(true),
	enableRedTeam: z.boolean().default(true),
	enableProductReview: z.boolean().default(true),
});
