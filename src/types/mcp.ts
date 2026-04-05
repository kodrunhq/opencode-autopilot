import { z } from "zod";

export const McpSkillSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	enabled: z.boolean().default(true),
	version: z.string().optional(),
	config: z.record(z.string(), z.unknown()).default({}),
});
export type McpSkill = z.infer<typeof McpSkillSchema>;

export const McpServerSchema = z.object({
	id: z.string().min(1),
	url: z.string().url().optional(),
	transport: z.enum(["stdio", "http", "sse"]).default("stdio"),
	enabled: z.boolean().default(true),
	skills: z.array(z.string()).default([]),
	metadata: z.record(z.string(), z.unknown()).default({}),
});
export type McpServer = z.infer<typeof McpServerSchema>;

export const mcpConfigSchema = z.object({
	enabled: z.boolean().default(false),
	skills: z.record(z.string(), z.unknown()).default({}),
});
export type McpConfig = z.infer<typeof mcpConfigSchema>;
export const mcpDefaults = mcpConfigSchema.parse({});
