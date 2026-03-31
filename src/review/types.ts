import type { z } from "zod";
import type {
	agentResultSchema,
	reviewConfigSchema,
	reviewFindingSchema,
	reviewReportSchema,
	severitySchema,
	verdictSchema,
} from "./schemas";

export type Severity = z.infer<typeof severitySchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type AgentResult = z.infer<typeof agentResultSchema>;
export type ReviewReport = z.infer<typeof reviewReportSchema>;
export type ReviewConfig = z.infer<typeof reviewConfigSchema>;

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
