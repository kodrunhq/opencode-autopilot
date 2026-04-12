import type { z } from "zod";
import type {
	programModeSchema,
	programRunSchema,
	programStatusSchema,
	trancheSchema,
	trancheStatusSchema,
} from "./schemas";

export type ProgramMode = z.infer<typeof programModeSchema>;
export type ProgramStatus = z.infer<typeof programStatusSchema>;
export type TrancheStatus = z.infer<typeof trancheStatusSchema>;
export type Tranche = z.infer<typeof trancheSchema>;
export type ProgramRun = z.infer<typeof programRunSchema>;

export interface BroadRequestAssessment {
	readonly isBroad: boolean;
	readonly workItems: readonly string[];
	readonly successCriteria: readonly string[];
	readonly reasons: readonly string[];
}
