import { z } from "zod";
import { PHASES } from "./schemas";

export const LESSON_DOMAINS = Object.freeze([
	"architecture",
	"testing",
	"review",
	"planning",
] as const);

export const lessonDomainSchema = z.enum(LESSON_DOMAINS);

export const lessonSchema = z.object({
	content: z.string().max(1024),
	domain: lessonDomainSchema,
	extractedAt: z.string().max(128),
	sourcePhase: z.enum(PHASES),
});

export const lessonMemorySchema = z.object({
	schemaVersion: z.literal(1),
	lessons: z.array(lessonSchema).max(50),
	lastUpdatedAt: z.string().max(128).nullable(),
});
