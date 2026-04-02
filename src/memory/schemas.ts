import { z } from "zod";
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

export const projectSchema = z.object({
	id: z.string(),
	path: z.string(),
	name: z.string(),
	lastUpdated: z.string(),
});

export const preferenceSchema = z.object({
	id: z.string(),
	key: z.string().min(1).max(200),
	value: z.string().min(1).max(2000),
	confidence: z.number().min(0).max(1).default(0.5),
	sourceSession: z.string().nullable().default(null),
	createdAt: z.string(),
	lastUpdated: z.string(),
});
