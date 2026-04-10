import { z } from "zod";
import { projectRecordSchema } from "../projects/schemas";
import {
	MAX_MEMORY_CONTENT_LENGTH,
	MAX_MEMORY_SUMMARY_LENGTH,
	MAX_MEMORY_TAGS,
	MAX_MEMORY_TOPIC_GROUP_LENGTH,
	MAX_MEMORY_TOPIC_LENGTH,
	MEMORY_KINDS,
	MEMORY_SCOPES,
	MEMORY_SOURCE_KINDS,
	MEMORY_STATUSES,
	OBSERVATION_TYPES,
} from "./constants";

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

export const memoryKindSchema = z.enum(MEMORY_KINDS);

export const memoryScopeSchema = z.enum(MEMORY_SCOPES);

export const memoryStatusSchema = z.enum(MEMORY_STATUSES);

export const memorySourceKindSchema = z.enum(MEMORY_SOURCE_KINDS);

export const memoryTagsSchema = z.array(z.string().min(1).max(50)).max(MAX_MEMORY_TAGS).default([]);

export const memorySchema = z.object({
	id: z.number().int().optional(),
	textId: z.string().min(1),
	projectId: z.string().nullable().default(null),
	kind: memoryKindSchema,
	scope: memoryScopeSchema,
	content: z.string().min(1).max(MAX_MEMORY_CONTENT_LENGTH),
	summary: z.string().min(1).max(MAX_MEMORY_SUMMARY_LENGTH),
	reasoning: z.string().nullable().default(null),
	confidence: z.number().min(0).max(1).default(0.8),
	evidenceCount: z.number().int().min(0).default(1),
	tags: memoryTagsSchema,
	sourceSession: z.string().nullable().default(null),
	status: memoryStatusSchema.default("active"),
	supersedesMemoryId: z.string().nullable().default(null),
	accessCount: z.number().int().min(0).default(0),
	topicGroup: z.string().min(1).max(MAX_MEMORY_TOPIC_GROUP_LENGTH).nullable().default(null),
	topic: z.string().min(1).max(MAX_MEMORY_TOPIC_LENGTH).nullable().default(null),
	sourceKind: memorySourceKindSchema.default("curated"),
	createdAt: z.string(),
	lastUpdated: z.string(),
	lastAccessed: z.string(),
});

export const memoryEvidenceSchema = z.object({
	id: z.string().min(1),
	memoryId: z.number().int(),
	sessionId: z.string().nullable().default(null),
	statement: z.string().min(1).max(4000),
	statementHash: z.string().min(1).max(128),
	confidence: z.number().min(0).max(1).default(0.8),
	createdAt: z.string(),
});

export const memorySaveInputSchema = z.object({
	kind: memoryKindSchema,
	content: z.string().min(1).max(MAX_MEMORY_CONTENT_LENGTH),
	summary: z.string().min(1).max(MAX_MEMORY_SUMMARY_LENGTH),
	reasoning: z.string().nullable().optional(),
	tags: memoryTagsSchema.optional(),
	scope: memoryScopeSchema.optional(),
	topicGroup: z.string().min(1).max(MAX_MEMORY_TOPIC_GROUP_LENGTH).optional(),
	topic: z.string().min(1).max(MAX_MEMORY_TOPIC_LENGTH).optional(),
	sourceKind: memorySourceKindSchema.optional(),
});
