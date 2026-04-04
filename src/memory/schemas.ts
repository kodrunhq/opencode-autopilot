import { z } from "zod";
import { projectRecordSchema } from "../projects/schemas";
import { OBSERVATION_TYPES } from "./constants";

export const observationTypeSchema = z.enum(OBSERVATION_TYPES);

export const observationSchema = z.object({
	id: z.number().int().optional(),
	projectId: z.string().nullable(),
	sessionId: z.string(),
	type: observationTypeSchema,
	content: z.string().min(1).max(10000),
	summary: z.string().min(1).max(500),
	confidence: z.number().min(0).max(1).default(0.5),
	accessCount: z.number().int().min(0).default(0),
	createdAt: z.string(),
	lastAccessed: z.string(),
});

export const projectSchema = projectRecordSchema;

const preferenceBaseSchema = z.object({
	id: z.string(),
	key: z.string().min(1).max(200),
	value: z.string().min(1).max(2000),
	confidence: z.number().min(0).max(1).default(0.5),
	scope: z.enum(["global", "project"]).default("global"),
	projectId: z.string().nullable().default(null),
	status: z.enum(["candidate", "confirmed", "rejected"]).default("confirmed"),
	evidenceCount: z.number().int().min(0).default(0),
	sourceSession: z.string().nullable().default(null),
	createdAt: z.string(),
	lastUpdated: z.string(),
});

function validatePreferenceScope(value: {
	scope: "global" | "project";
	projectId: string | null;
}): boolean {
	return (
		(value.scope === "global" && value.projectId === null) ||
		(value.scope === "project" && value.projectId !== null)
	);
}

export const preferenceSchema = preferenceBaseSchema.refine(validatePreferenceScope, {
	message: "projectId must be set for project scope and null for global scope",
	path: ["projectId"],
});

export const preferenceRecordSchema = preferenceBaseSchema.refine(validatePreferenceScope, {
	message: "projectId must be set for project scope and null for global scope",
	path: ["projectId"],
});

export const preferenceEvidenceSchema = z.object({
	id: z.string(),
	preferenceId: z.string().min(1),
	sessionId: z.string().nullable().default(null),
	runId: z.string().nullable().default(null),
	statement: z.string().min(1).max(4000),
	statementHash: z.string().min(1).max(128),
	confidence: z.number().min(0).max(1).default(0.5),
	confirmed: z.boolean().default(false),
	createdAt: z.string(),
});
