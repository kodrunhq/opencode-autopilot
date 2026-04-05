import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { BackgroundManager } from "../background/manager";
import { loadConfig } from "../config";
import { openKernelDb } from "../kernel/database";
import { makeRoutingDecision } from "../routing";
import { getCategoryDefinition } from "../routing/categories";
import { type Category, CategoryConfigSchema, CategorySchema } from "../types/routing";

function buildDisplayText(input: {
	readonly task: string;
	readonly category: Category;
	readonly confidence: number;
	readonly reasoning: string;
	readonly modelGroup: string;
	readonly skills: readonly string[];
	readonly taskId?: string;
}): string {
	const skillLine = input.skills.length > 0 ? input.skills.join(", ") : "none";
	const lines = [
		"Routing decision",
		`Task: ${input.task}`,
		`Category: ${input.category}`,
		`Confidence: ${input.confidence.toFixed(2)}`,
		`Model group: ${input.modelGroup}`,
		`Skills: ${skillLine}`,
		`Reasoning: ${input.reasoning}`,
	];
	if (input.taskId) {
		lines.push(`Background task ID: ${input.taskId}`);
	}
	return lines.join("\n");
}

interface DelegateCoreOptions {
	readonly sessionId?: string;
	readonly spawn?: boolean;
}

interface ResolvedRouting {
	readonly category: Category;
	readonly confidence: number;
	readonly reasoning: string;
	readonly modelGroup: string;
	readonly agentId: string | undefined;
	readonly skills: readonly string[];
}

function resolveRoutingDecision(
	task: string,
	category: string | undefined,
	config: Awaited<ReturnType<typeof loadConfig>>,
): ResolvedRouting | null {
	if (category !== undefined) {
		const parsedCategory = CategorySchema.safeParse(category);
		if (!parsedCategory.success) {
			return null;
		}

		const explicitDefinition = getCategoryDefinition(parsedCategory.data);
		const override = config?.routing.categories[parsedCategory.data];
		const appliedConfig = CategoryConfigSchema.parse({
			enabled: override?.enabled ?? true,
			agentId: override?.agentId,
			modelGroup: override?.modelGroup ?? explicitDefinition.modelGroup,
			timeoutSeconds: override?.timeoutSeconds ?? explicitDefinition.timeoutSeconds,
			skills: override?.skills ?? [...explicitDefinition.skills],
			metadata: {
				maxIterations: explicitDefinition.maxIterations,
				...(override?.metadata ?? {}),
			},
		});

		return {
			category: parsedCategory.data,
			confidence: 1,
			reasoning: `Category explicitly provided as '${parsedCategory.data}'.`,
			modelGroup: appliedConfig?.modelGroup ?? explicitDefinition.modelGroup,
			agentId: appliedConfig?.agentId,
			skills: appliedConfig?.skills ?? explicitDefinition.skills,
		};
	}

	const decision = makeRoutingDecision(task, config?.routing);
	const definition = getCategoryDefinition(decision.category);
	return {
		category: decision.category,
		confidence: decision.confidence,
		reasoning: decision.reasoning ?? "No routing reasoning available.",
		modelGroup: decision.appliedConfig?.modelGroup ?? definition.modelGroup,
		agentId: decision.agentId,
		skills: decision.appliedConfig?.skills ?? definition.skills,
	};
}

let defaultDelegateManager: BackgroundManager | null = null;

function getDelegateManager(db?: Database): BackgroundManager {
	if (db) {
		return new BackgroundManager({ db });
	}
	if (defaultDelegateManager) {
		return defaultDelegateManager;
	}
	defaultDelegateManager = new BackgroundManager({ db: openKernelDb() });
	return defaultDelegateManager;
}

export async function delegateCore(
	task: string,
	category?: string,
	db?: Database,
	options?: DelegateCoreOptions,
): Promise<string> {
	if (task.trim().length === 0) {
		return JSON.stringify({
			action: "error",
			message: "Task is required.",
		});
	}

	const config = await loadConfig();

	if (category !== undefined) {
		const parsedCategory = CategorySchema.safeParse(category);
		if (!parsedCategory.success) {
			return JSON.stringify({
				action: "error",
				message: `Invalid category '${category}'.`,
			});
		}
	}

	const routing = resolveRoutingDecision(task, category, config);
	if (!routing) {
		return JSON.stringify({
			action: "error",
			message: `Invalid category '${category}'.`,
		});
	}

	const shouldSpawn = options?.spawn !== false;
	let taskId: string | undefined;

	if (shouldSpawn) {
		const manager = getDelegateManager(db);
		const sessionId = options?.sessionId ?? "delegate-session";
		taskId = manager.spawn(sessionId, task, {
			category: routing.category,
			agent: routing.agentId,
			model: routing.modelGroup,
		});

		if (db) {
			await manager.waitForIdle();
			await manager.dispose();
		}
	}

	return JSON.stringify({
		action: shouldSpawn ? "delegated" : "routing_only",
		category: routing.category,
		confidence: routing.confidence,
		reasoning: routing.reasoning,
		suggestedModelGroup: routing.modelGroup,
		suggestedSkills: routing.skills,
		...(taskId ? { taskId } : {}),
		displayText: buildDisplayText({
			task,
			category: routing.category,
			confidence: routing.confidence,
			reasoning: routing.reasoning,
			modelGroup: routing.modelGroup,
			skills: routing.skills,
			taskId,
		}),
	});
}

export const ocDelegate = tool({
	description:
		"Route a task to the best category and spawn a background task with the routing decision. Returns routing info and a background task ID.",
	args: {
		task: tool.schema.string().min(1).max(4096).describe("Task description to route"),
		category: CategorySchema.optional().describe("Optional explicit routing category override"),
		spawn: tool.schema
			.boolean()
			.optional()
			.default(true)
			.describe("Whether to spawn a background task (default: true)"),
	},
	async execute(args, context) {
		return delegateCore(args.task, args.category, undefined, {
			sessionId: context.sessionID,
			spawn: args.spawn,
		});
	},
});
