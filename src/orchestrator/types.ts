import type { z } from "zod";
import type {
	buildProgressSchema,
	confidenceEntrySchema,
	decisionEntrySchema,
	dispatchResultKindSchema,
	failureContextSchema,
	pendingDispatchSchema,
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
export type BuildProgress = z.infer<typeof buildProgressSchema>;
export type FailureContext = z.infer<typeof failureContextSchema>;
export type PendingDispatch = z.infer<typeof pendingDispatchSchema>;
export type DispatchResultKind = z.infer<typeof dispatchResultKindSchema>;
