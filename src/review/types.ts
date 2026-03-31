import type { z } from "zod";
import type {
	agentResultSchema,
	falsePositiveSchema,
	reviewConfigSchema,
	reviewFindingSchema,
	reviewMemorySchema,
	reviewReportSchema,
	reviewStateSchema,
	severitySchema,
	verdictSchema,
} from "./schemas";

export type Severity = z.infer<typeof severitySchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type AgentResult = z.infer<typeof agentResultSchema>;
export type ReviewReport = z.infer<typeof reviewReportSchema>;
export type ReviewConfig = z.infer<typeof reviewConfigSchema>;
export type FalsePositive = z.infer<typeof falsePositiveSchema>;
export type ReviewMemory = z.infer<typeof reviewMemorySchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;

export type AgentCategory = "core" | "parallel" | "sequenced";

export interface AgentDefinition {
	readonly name: string;
	readonly category: AgentCategory;
	readonly domain: string;
	readonly catches: readonly string[];
	readonly triggerSignals: readonly string[];
	readonly stackAffinity: readonly string[];
	readonly hardGatesSummary: string;
}
