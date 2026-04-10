import type { z } from "zod";
import type {
	memoryEvidenceSchema,
	memoryKindSchema,
	memorySaveInputSchema,
	memorySchema,
	memoryScopeSchema,
	memorySourceKindSchema,
	memoryStatusSchema,
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

export type MemoryKind = z.infer<typeof memoryKindSchema>;
export type MemoryScope = z.infer<typeof memoryScopeSchema>;
export type MemorySourceKind = z.infer<typeof memorySourceKindSchema>;
export type MemoryStatus = z.infer<typeof memoryStatusSchema>;
export type Memory = z.infer<typeof memorySchema>;
export type MemoryEvidence = z.infer<typeof memoryEvidenceSchema>;
export type MemorySaveInput = z.infer<typeof memorySaveInputSchema>;
