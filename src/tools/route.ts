import { tool } from "@opencode-ai/plugin";
import {
	getIntentRouting,
	IntentClassificationSchema,
	type IntentType,
	IntentTypeSchema,
} from "../routing/intent-types";
import { issueRouteToken } from "../routing/route-token";

function resolveProjectRoot(context: {
	readonly directory?: string;
	readonly worktree?: string;
}): string {
	if (typeof context.worktree === "string" && context.worktree.length > 0) {
		return context.worktree;
	}
	if (typeof context.directory === "string" && context.directory.length > 0) {
		return context.directory;
	}
	return process.cwd();
}

function buildInstruction(
	_intent: IntentType,
	routing: Readonly<{ targetAgent: string; usePipeline: boolean; behavior: string }>,
): string {
	if (routing.usePipeline) {
		return `Call oc_orchestrate with intent: "implementation" and routeToken from requiredPipelineArgs.routeToken - full pipeline via ${routing.targetAgent}. ${routing.behavior}`;
	}
	return `Route to ${routing.targetAgent} agent directly — no pipeline needed. ${routing.behavior}`;
}

function buildSecondaryInstruction(
	secondary: IntentType,
	secondaryRouting: Readonly<{ targetAgent: string; usePipeline: boolean; behavior: string }>,
): string {
	const intentHint =
		secondary === "implementation"
			? ' (pass intent: "implementation" and routeToken from requiredPipelineArgs.routeToken to oc_orchestrate)'
			: "";
	return `After completing the primary intent, follow up with: ${secondaryRouting.behavior} (via ${secondaryRouting.targetAgent})${intentHint}`;
}

interface RouteCoreContext {
	sessionId: string;
	messageId: string;
	projectRoot: string;
}

export function routeCore(
	args: {
		readonly primaryIntent: string;
		readonly secondaryIntent?: string;
		readonly reasoning: string;
		readonly verbalization: string;
	},
	context?: RouteCoreContext,
): string {
	const parsedPrimary = IntentTypeSchema.safeParse(args.primaryIntent);
	if (!parsedPrimary.success) {
		return JSON.stringify({
			action: "error",
			message: `Invalid primary intent '${args.primaryIntent}'. Valid intents: ${IntentTypeSchema.options.join(", ")}.`,
		});
	}

	const parsedSecondary = args.secondaryIntent
		? IntentTypeSchema.safeParse(args.secondaryIntent)
		: undefined;
	if (parsedSecondary && !parsedSecondary.success) {
		return JSON.stringify({
			action: "error",
			message: `Invalid secondary intent '${args.secondaryIntent}'. Valid intents: ${IntentTypeSchema.options.join(", ")}.`,
		});
	}

	const classification = IntentClassificationSchema.safeParse({
		primaryIntent: parsedPrimary.data,
		secondaryIntent: parsedSecondary?.data,
		reasoning: args.reasoning,
		verbalization: args.verbalization,
	});
	if (!classification.success) {
		const issues = classification.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
		return JSON.stringify({
			action: "error",
			message: `Invalid classification: ${issues.join("; ")}.`,
		});
	}

	const primary: IntentType = classification.data.primaryIntent;
	const routing = getIntentRouting(primary);
	const instruction = buildInstruction(primary, routing);

	const result: Record<string, unknown> = {
		action: "route",
		primaryIntent: primary,
		reasoning: classification.data.reasoning,
		verbalization: classification.data.verbalization,
		targetAgent: routing.targetAgent,
		usePipeline: routing.usePipeline,
		behavior: routing.behavior,
		instruction,
	};

	if (context && routing.usePipeline && primary === "implementation") {
		const token = issueRouteToken({
			sessionID: context.sessionId,
			projectRoot: context.projectRoot,
			messageID: context.messageId,
			intent: "implementation",
		});

		result.routeToken = token.token;
		result.routeTokenMode = "single_use";
		result.routeTokenExpiresAt = token.expiresAt;
		result.requiredPipelineArgs = {
			intent: "implementation",
			routeToken: token.token,
		};
	}

	if (classification.data.secondaryIntent) {
		const secondary = classification.data.secondaryIntent;
		const secondaryRouting = getIntentRouting(secondary);
		result.secondaryIntent = secondary;
		result.secondaryTargetAgent = secondaryRouting.targetAgent;
		result.secondaryUsePipeline = secondaryRouting.usePipeline;
		result.secondaryBehavior = secondaryRouting.behavior;
		result.secondaryInstruction = buildSecondaryInstruction(secondary, secondaryRouting);
	}

	return JSON.stringify(result);
}

export const ocRoute = tool({
	description:
		"Validate intent classification and return routing instructions. The LLM classifies the user's intent, then calls this tool to validate the classification and get operational routing — which agent to use, whether to start the pipeline, and what behavior to follow. Call BEFORE oc_orchestrate on every new user message.",
	args: {
		primaryIntent: IntentTypeSchema.describe(
			"Primary intent type: research, implementation, investigation, evaluation, fix, review, planning, quick, or open_ended",
		),
		secondaryIntent: IntentTypeSchema.optional().describe(
			"Optional secondary intent for combined requests like 'research then implement'. Omit if single-intent.",
		),
		reasoning: tool.schema
			.string()
			.min(1)
			.max(2048)
			.describe(
				"Why this intent was chosen — what signals in the user message led to this classification",
			),
		verbalization: tool.schema
			.string()
			.min(1)
			.max(1024)
			.describe(
				"Human-readable intent statement, e.g. 'I detect research intent — user asked how X works'",
			),
	},
	execute(args, context) {
		const result = routeCore(
			{
				primaryIntent: args.primaryIntent,
				secondaryIntent: args.secondaryIntent,
				reasoning: args.reasoning,
				verbalization: args.verbalization,
			},
			{
				sessionId: context.sessionID,
				messageId: context.messageID,
				projectRoot: resolveProjectRoot(context),
			},
		);
		return Promise.resolve(result);
	},
});
