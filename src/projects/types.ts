import type { z } from "zod";
import type {
	gitFingerprintInputSchema,
	projectGitFingerprintSchema,
	projectPathRecordSchema,
	projectRecordSchema,
} from "./schemas";

export type ProjectRecord = z.infer<typeof projectRecordSchema>;
export type ProjectPathRecord = z.infer<typeof projectPathRecordSchema>;
export type ProjectGitFingerprint = z.infer<typeof projectGitFingerprintSchema>;
export type GitFingerprintInput = z.infer<typeof gitFingerprintInputSchema>;
