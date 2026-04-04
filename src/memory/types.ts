import type { z } from "zod";
import type {
	observationSchema,
	observationTypeSchema,
	preferenceEvidenceSchema,
	preferenceRecordSchema,
	preferenceSchema,
	projectSchema,
} from "./schemas";

export type ObservationType = z.infer<typeof observationTypeSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Preference = z.infer<typeof preferenceSchema>;
export type PreferenceRecord = z.infer<typeof preferenceRecordSchema>;
export type PreferenceEvidence = z.infer<typeof preferenceEvidenceSchema>;
