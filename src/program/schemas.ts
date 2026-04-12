import { z } from "zod";

export const programModeSchema = z.enum(["autonomous", "interactive"]);

export const programStatusSchema = z.enum(["ACTIVE", "COMPLETED", "BLOCKED", "ABANDONED"]);

export const trancheStatusSchema = z.enum([
	"PENDING",
	"QUEUED",
	"IN_PROGRESS",
	"SHIPPED",
	"COMPLETED",
	"BLOCKED",
]);

export const trancheSchema = z.object({
	trancheId: z
		.string()
		.min(1)
		.max(128)
		.regex(/^[a-z0-9_-]+$/i, "trancheId must be alphanumeric with hyphens or underscores"),
	sequence: z.number().int().positive(),
	title: z.string().min(1).max(512),
	objective: z.string().min(1).max(2048),
	scope: z.array(z.string().min(1).max(1024)).max(50).default([]),
	dependencies: z.array(z.string().min(1).max(128)).max(50).default([]),
	status: trancheStatusSchema,
	verificationProfile: z.string().min(1).max(128),
	deliveryManifestId: z.string().max(256).nullable().default(null),
	selectionRationale: z.string().max(2048).default(""),
});

export const programRunSchema = z.object({
	schemaVersion: z.literal(1),
	programId: z
		.string()
		.min(1)
		.max(128)
		.regex(/^[a-z0-9_-]+$/i, "programId must be alphanumeric with hyphens or underscores"),
	originatingRequest: z.string().min(1).max(16000),
	mode: programModeSchema,
	createdAt: z.string().max(128),
	status: programStatusSchema,
	successCriteria: z.array(z.string().min(1).max(1024)).max(100).default([]),
	tranches: z.array(trancheSchema).min(1).max(100),
	currentTrancheId: z.string().max(128).nullable(),
	finalOracleVerdict: z.string().max(1024).nullable().default(null),
	blockedReason: z.string().max(2048).nullable().default(null),
});
