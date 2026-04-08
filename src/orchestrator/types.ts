import type { z } from "zod";
import type {
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

// Re-export BuildProgress from schemas
export type { BuildProgress } from "./schemas";

export interface BranchLifecycle {
	readonly currentBranch: string | null;
	readonly baseBranch: string | null;
	readonly prNumber: number | null;
	readonly prUrl: string | null;
	readonly worktreePath: string | null;
	readonly createdAt: string | null;
	readonly lastPushedAt: string | null;
	readonly tasksPushed: readonly string[];
}

export type PipelineState = z.infer<typeof pipelineStateSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type PhaseStatus = z.infer<typeof phaseStatusSchema>;
export type DecisionEntry = z.infer<typeof decisionEntrySchema>;
export type ConfidenceEntry = z.infer<typeof confidenceEntrySchema>;
export type Task = z.infer<typeof taskSchema>;
// BuildProgress is imported from schemas as an interface (not z.infer)
export type FailureContext = z.infer<typeof failureContextSchema>;
export type PendingDispatch = z.infer<typeof pendingDispatchSchema>;
export type DispatchResultKind = z.infer<typeof dispatchResultKindSchema>;
