import type { z } from "zod";
import type {
	confidenceEntrySchema,
	decisionEntrySchema,
	phaseSchema,
	phaseStatusSchema,
	pipelineStateSchema,
	taskSchema,
} from "./schemas";

export type PipelineState = z.infer<typeof pipelineStateSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type PhaseStatus = z.infer<typeof phaseStatusSchema>;
export type DecisionEntry = z.infer<typeof decisionEntrySchema>;
export type ConfidenceEntry = z.infer<typeof confidenceEntrySchema>;
export type Task = z.infer<typeof taskSchema>;
