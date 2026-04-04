import { z } from "zod";

export const projectRecordSchema = z.object({
	id: z.string().min(1).max(128),
	path: z.string().min(1).max(4096),
	name: z.string().min(1).max(256),
	firstSeenAt: z.string().min(1).max(128).optional(),
	lastUpdated: z.string().min(1).max(128),
});

export const projectPathRecordSchema = z.object({
	projectId: z.string().min(1).max(128),
	path: z.string().min(1).max(4096),
	firstSeenAt: z.string().min(1).max(128),
	lastUpdated: z.string().min(1).max(128),
	isCurrent: z.boolean(),
});

export const projectGitFingerprintSchema = z.object({
	projectId: z.string().min(1).max(128),
	normalizedRemoteUrl: z.string().min(1).max(2048),
	defaultBranch: z.string().min(1).max(256).nullable(),
	firstSeenAt: z.string().min(1).max(128),
	lastUpdated: z.string().min(1).max(128),
});

export const gitFingerprintInputSchema = z.object({
	normalizedRemoteUrl: z.string().min(1).max(2048),
	defaultBranch: z.string().min(1).max(256).nullable().default(null),
});
