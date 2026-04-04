import type { z } from "zod";
import type {
	forensicEventDomainSchema,
	forensicEventSchema,
	forensicEventTypeSchema,
} from "./forensic-schemas";

export type ForensicEventDomain = z.infer<typeof forensicEventDomainSchema>;
export type ForensicEventType = z.infer<typeof forensicEventTypeSchema>;
export type ForensicEvent = z.infer<typeof forensicEventSchema>;
