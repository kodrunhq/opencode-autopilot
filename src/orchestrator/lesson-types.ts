import type { z } from "zod";
import type { lessonDomainSchema, lessonMemorySchema, lessonSchema } from "./lesson-schemas";

export type Lesson = z.infer<typeof lessonSchema>;
export type LessonDomain = z.infer<typeof lessonDomainSchema>;
export type LessonMemory = z.infer<typeof lessonMemorySchema>;
