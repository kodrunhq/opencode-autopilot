import type { Database } from "bun:sqlite";
import { tool } from "@opencode-ai/plugin";
import { loadConfig } from "../config";
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
}): string {
	const skillLine = input.skills.length > 0 ? input.skills.join(", ") : "none";
	return [
		"Routing decision",
		`Task: ${input.task}`,
		`Category: ${input.category}`,
		`Confidence: ${input.confidence.toFixed(2)}`,
		`Model group: ${input.modelGroup}`,
		`Skills: ${skillLine}`,
		`Reasoning: ${input.reasoning}`,
	].join("\n");
}

export async function delegateCore(
	task: string,
	category?: string,
	db?: Database,
): Promise<string> {
	void db;

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

		const explicitResult = {
			category: parsedCategory.data,
			confidence: 1,
			reasoning: `Category explicitly provided as '${parsedCategory.data}'.`,
			suggestedModelGroup: appliedConfig?.modelGroup ?? explicitDefinition.modelGroup,
			suggestedSkills: appliedConfig?.skills ?? explicitDefinition.skills,
			displayText: buildDisplayText({
				task,
				category: parsedCategory.data,
				confidence: 1,
				reasoning: `Category explicitly provided as '${parsedCategory.data}'.`,
				modelGroup: appliedConfig?.modelGroup ?? explicitDefinition.modelGroup,
				skills: appliedConfig?.skills ?? explicitDefinition.skills,
			}),
		};

		return JSON.stringify(explicitResult);
	}

	const decision = makeRoutingDecision(task, config?.routing);
	const definition = getCategoryDefinition(decision.category);
	const suggestedModelGroup = decision.appliedConfig?.modelGroup ?? definition.modelGroup;
	const suggestedSkills = decision.appliedConfig?.skills ?? definition.skills;

	return JSON.stringify({
		category: decision.category,
		confidence: decision.confidence,
		reasoning: decision.reasoning ?? "No routing reasoning available.",
		suggestedModelGroup,
		suggestedSkills,
		displayText: buildDisplayText({
			task,
			category: decision.category,
			confidence: decision.confidence,
			reasoning: decision.reasoning ?? "No routing reasoning available.",
			modelGroup: suggestedModelGroup,
			skills: suggestedSkills,
		}),
	});
}

export const ocDelegate = tool({
	description:
		"Route a task to the best category and suggest the optimal model group and skills. Returns a routing decision only; it does not spawn background work.",
	args: {
		task: tool.schema.string().min(1).max(4096).describe("Task description to route"),
		category: CategorySchema.optional().describe("Optional explicit routing category override"),
	},
	async execute(args) {
		return delegateCore(args.task, args.category);
	},
});
