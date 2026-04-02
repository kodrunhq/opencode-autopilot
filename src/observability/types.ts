import type { z } from "zod";
import type {
	baseEventSchema,
	decisionEventSchema,
	errorEventSchema,
	fallbackEventSchema,
	loggingConfigSchema,
	modelSwitchEventSchema,
	sessionDecisionSchema,
	sessionEventSchema,
	sessionLogSchema,
} from "./schemas";

export type SessionEventType = "fallback" | "error" | "decision" | "model_switch";

export type BaseEvent = z.infer<typeof baseEventSchema>;
export type FallbackEvent = z.infer<typeof fallbackEventSchema>;
export type ErrorEvent = z.infer<typeof errorEventSchema>;
export type DecisionEvent = z.infer<typeof decisionEventSchema>;
export type ModelSwitchEvent = z.infer<typeof modelSwitchEventSchema>;
export type SessionEvent = z.infer<typeof sessionEventSchema>;
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;
export type SessionDecision = z.infer<typeof sessionDecisionSchema>;
export type SessionLog = z.infer<typeof sessionLogSchema>;
