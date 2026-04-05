import { z } from "zod";

export const TaskStatusSchema = z.enum(["pending", "running", "completed", "failed", "cancelled"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskResultSchema = z.object({
	taskId: z.string().min(1),
	status: TaskStatusSchema,
	output: z.string().optional(),
	error: z.string().optional(),
	startedAt: z.number().optional(),
	completedAt: z.number().optional(),
	durationMs: z.number().optional(),
});
export type TaskResult = z.infer<typeof TaskResultSchema>;

export const BackgroundTaskSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	status: TaskStatusSchema,
	agentId: z.string().optional(),
	priority: z.number().int().min(0).max(100).default(50),
	createdAt: z.number(),
	result: TaskResultSchema.optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
});
export type BackgroundTask = z.infer<typeof BackgroundTaskSchema>;

export const AgentSlotSchema = z.object({
	slotId: z.string().min(1),
	agentId: z.string().min(1),
	capacity: z.number().int().min(1).max(100).default(1),
	activeTaskCount: z.number().int().min(0).default(0),
	reserved: z.boolean().default(false),
});
export type AgentSlot = z.infer<typeof AgentSlotSchema>;

export const ConcurrencyLimitsSchema = z.object({
	global: z.number().int().min(1).max(50).default(5),
	perAgent: z.number().int().min(1).max(10).default(2),
	perCategory: z.record(z.string(), z.number().int().min(1).max(20)).default({}),
});
export type ConcurrencyLimits = z.infer<typeof ConcurrencyLimitsSchema>;

export const backgroundConfigSchema = z.object({
	enabled: z.boolean().default(false),
	maxConcurrent: z.number().int().min(1).max(50).default(5),
	persistence: z.boolean().default(true),
});
export type BackgroundConfig = z.infer<typeof backgroundConfigSchema>;
export const backgroundDefaults = backgroundConfigSchema.parse({});
